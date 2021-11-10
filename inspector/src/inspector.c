/**
 * 
 * VP8 Frame Inspector
 * 
 * The inspector use GStreamer to receive RTP packets from 
 * UDP socket or PCAP files and extract the VP8 frames 
 * from VP8 streams.
 * 
 * We are using a very simple parser to extract VP8 frame 
 * header info based on the example in the specification 
 * (https://github.com/webmproject/bitstream-guide).
 * 
 * 
 * How it works?
 * 
 * The main pipeline contains a rtpbin module that detects new SSRC. 
 * So for each SSRC detected with the specified payload type, we create a new
 * bin containing the rtpvp8depay part. After we got the frames we process 
 * them to extract the desided data.
 * 
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <glib-unix.h>
#include <gst/gst.h>

#include "bool_decoder.h"
#include "vp8_parser.h"

enum {
  OK = 0,
  ERROR_PARSE_ARGS = 1,
  ERROR_INVALID_ARGS = 2,
  ERROR_PIPELINE_LINK = 3
};

typedef struct 
{
  gchar * ssrc;
  GstElement *bin;
  GstClockTime ptsOffset;
  guint frameNumber;
  FrameResolution lastResolution;
  FILE *fdout;
} StreamInspector;

typedef struct
{
  GMainLoop *loop;
  GstElement *pipeline;
  GstElement *rtpsrc;
  GstElement *rtpbin;
  gboolean closing;
  gboolean ready;
  GHashTable *streams;
} Inspector;


static gint port = -1;
static gint payloadType = 0;
static gchar * outputPath = NULL;
static gchar * inputFile = NULL;
static gboolean useStdout = FALSE;

static GOptionEntry entries[] =
{
  { "port", 'p', 0, G_OPTION_ARG_INT, &port, "Port to receive rtp stream", "50000" },
  { "payloadType", 't', 0, G_OPTION_ARG_INT, &payloadType, "Expected VP8 Payload Type [96-127]", "96" },
  { "file", 'f', 0, G_OPTION_ARG_STRING, &inputFile, "PCAP file as source", "./sample.pcap" },
  { "outputPath", 'o', 0, G_OPTION_ARG_STRING, &outputPath, "Path to inspector logs", "./inspector-logs" },
  { "stdout", 0, 0, G_OPTION_ARG_NONE, &useStdout, "Send the inspector results to stdout", NULL },
  { NULL }
};

void
log_info (gchar *str, ...)
{
  gchar *info = g_strdup_printf("%s\n", str);
  va_list arg;
  va_start(arg, str);
  vfprintf(stderr, info, arg);
  va_end(arg);
  g_free(info);
}

/**
 * 
 * This function is called to dump the frame info.
 * It can dump to an output file (--outputPath option should be setted)
 * and/or stdout (--stdout option)
 * 
 * */
void
dump_frame_info (StreamInspector * streamInspector , FrameInfo * ctx)
{
  gchar * result = g_strdup_printf(
    "ssrc: %s, frame: %u, pts: %" G_GUINT64_FORMAT ", ok: %u, keyframe: %u, show: %u, width: %u, height: %u, refreshGoldenFrame: %u, refreshAltrefFrame: %u \n",
    streamInspector->ssrc, ctx->frameNumber, GST_TIME_AS_MSECONDS(ctx->pts), ctx->ok, ctx->keyframe, ctx->showFrame,  
    ctx->resolution.width, ctx->resolution.height, ctx->refreshGoldenFrame, ctx->refreshAltrefFrame);

  if (useStdout) {
    fprintf(stdout, "%s", result);
    fflush(stdout);
  }

  if (outputPath) {
    fprintf(streamInspector->fdout, "%s", result);
    fflush(streamInspector->fdout);
  }

  g_free(result);
}

/**
 * 
 * This function is called when we got a VP8 frame.
 * We read the frame header according https://datatracker.ietf.org/doc/html/draft-bankoski-vp8-bitstream-06 
 * and https://github.com/webmproject/bitstream-guide to find all desired info.
 * 
 **/
void
inspect_frame_info(StreamInspector * streamInspector, unsigned char * data, unsigned int size, GstClockTime timestamp)
{
  struct bool_decoder bool;
  FrameInfo * ctx = calloc(1, 1 * sizeof(FrameInfo));

  ctx->ok = FALSE;
  ctx->pts = timestamp;
  ctx->frameNumber = streamInspector->frameNumber++;

  if (vp8_parse_frame_header(data, size, ctx)) goto dump_frame;

  data += FRAME_HEADER_SZ;
  size -= FRAME_HEADER_SZ;
  if (ctx->keyframe)
  {
    data += KEYFRAME_HEADER_SZ;
    size -= KEYFRAME_HEADER_SZ;
  }

  if (ctx->keyframe) {
    streamInspector->lastResolution.width = ctx->resolution.width;
    streamInspector->lastResolution.widthScale = ctx->resolution.widthScale;
    streamInspector->lastResolution.height = ctx->resolution.height;
    streamInspector->lastResolution.heightScale = ctx->resolution.heightScale;
  } else {      
    ctx->resolution.width = streamInspector->lastResolution.width;
    ctx->resolution.widthScale = streamInspector->lastResolution.widthScale;
    ctx->resolution.height = streamInspector->lastResolution.height;
    ctx->resolution.heightScale = streamInspector->lastResolution.heightScale;
  }

  init_bool_decoder(&bool, data, ctx->partSize);

  /* Skip the colorspace and clamping bits */
  if (ctx->keyframe) {
    bool_get_uint(&bool, 2);
  }

  if (vp8_parse_segmentation_header(&bool)) 
    goto dump_frame;
  
  if (vp8_parse_loopfilter_header(&bool)) 
    goto dump_frame;

  if (vp8_parse_partitions(&bool)) 
    goto dump_frame;

  if (vp8_parse_quantizer_header(&bool)) 
    goto dump_frame;

  if (vp8_parse_reference_header(&bool, ctx)) 
    goto dump_frame;

  ctx->ok = TRUE;
  
  dump_frame:

  dump_frame_info(streamInspector, ctx);
  free(ctx);
}


/**
 *
 * This function is called to initialize a StreamInspector struct
 *  
 **/
StreamInspector *
stream_inspector_initialize (gchar * padName) {
  log_info("stream_inspector_initialize [padName: %s]", padName);

  StreamInspector * streamInspector = (StreamInspector *) malloc(1 * sizeof(StreamInspector));
  gchar **split = g_strsplit(padName, "_", 0);
  gchar *ssrc = split[4];

  streamInspector->bin = gst_bin_new(NULL);
  streamInspector->ssrc = g_strdup_printf("%s", ssrc);
  streamInspector->ptsOffset = 0;
  streamInspector->frameNumber = 0;
  streamInspector->lastResolution.width = 0;
  streamInspector->lastResolution.widthScale = 0;
  streamInspector->lastResolution.height = 0;
  streamInspector->lastResolution.heightScale = 0;
  streamInspector->fdout = NULL;

  g_object_set(streamInspector->bin, "message-forward", TRUE, NULL);


  if (outputPath) {
    gchar * filename = g_strdup_printf("%s/%s.log", outputPath, ssrc);
    streamInspector->fdout = fopen(filename, "w");
    g_free(filename);
  }

  g_strfreev(split);
  return streamInspector;
}

/**
 * 
 * This function is called to handle with SIGINT
 * We are stopping the process here, but we
 * should have sure that all buffers were processed.
 * We can improve it in the future.
 * 
 */
gboolean
signal_handler (gpointer data)
{
  Inspector * inspector = (Inspector *)data;
  log_info("signal_handler: received a SIGINT, emitting EOS event to pipeline");
  g_main_loop_quit(inspector->loop);
  return TRUE;
}

/**
 *
 * This function is called to lead with some pipeline messages.
 * We wait for some messages to exec the pipeline cleaning for example.
 * 
 */
static gboolean
bus_handler (GstBus * bus, GstMessage * message, gpointer data)
{
  Inspector * inspector = (Inspector *)data;
  switch (GST_MESSAGE_TYPE(message)) {
    case GST_MESSAGE_EOS : {
      if (inspector->closing) {
        log_info("bus_handler: received EOS when pipeline was closing, stopping pipeline now");
        g_main_loop_quit(inspector->loop);
      }
      break;
    }
    case GST_MESSAGE_ELEMENT : {
      if (!inspector->closing) {
        const GstStructure * messageStructure = gst_message_get_structure (message);
        if (gst_structure_has_name (messageStructure, "GstBinForwarded")){
          GstMessage *forwardMessage = NULL;
          gst_structure_get (messageStructure, "message", GST_TYPE_MESSAGE, &forwardMessage, NULL);
          if (GST_MESSAGE_TYPE (forwardMessage) == GST_MESSAGE_EOS) {
            log_info("bus_handler: received EOS from bin %s, removing bin now", GST_MESSAGE_SRC_NAME(message));
            GstElement * bin = GST_ELEMENT(GST_MESSAGE_SRC(message));            
            gst_element_set_state(bin, GST_STATE_NULL);
            gst_bin_remove(GST_BIN(inspector->pipeline), bin); 

            // TODO: remove this workaround in future
            if (inputFile) {
              g_main_loop_quit(inspector->loop);
            }
          }
          gst_message_unref (forwardMessage);
        }
      }
      break;
    }
    case GST_MESSAGE_STATE_CHANGED : {
      // we only care about pipeline state change messages
      if (GST_MESSAGE_SRC (message) == GST_OBJECT_CAST (inspector->pipeline)) {
        GstState old, new, pending;
        gst_message_parse_state_changed (message, &old, &new, &pending);
        if (new == GST_STATE_PLAYING && inspector->ready == FALSE) {
          log_info("VP8 Frame Inspector is ready!");
          fprintf(stdout, "ready\n");
          fflush(stdout);
          inspector->ready = TRUE;
        }
      }
      break;
    }
    default : 
      break;
  }

  return TRUE;
}

/**
 * 
 * This function is called when we have a VP8 Frame available.
 * Here we use the GstBuffer PTS as the frame presentation time (minus the start offset).
 * The Frame buffer should be processed by the inspect_frame_info() function.
 *
 */
static GstPadProbeReturn
buffer_probe(GstPad * pad, GstPadProbeInfo * info, gpointer data)
{ 
  GstMapInfo map;
  GstBuffer * buffer = gst_pad_probe_info_get_buffer(info);
  StreamInspector * streamInspector = (StreamInspector*) data;

  GstClockTime bufferTimestamp = GST_BUFFER_DTS_OR_PTS(buffer);
  // NOTE: The buffer clock time is relative to pipeline start time, so we are marking the offset
  if (streamInspector->ptsOffset == 0) {
    streamInspector->ptsOffset = bufferTimestamp;
  }

  GstClockTime timestamp = bufferTimestamp - streamInspector->ptsOffset;
  int res = gst_buffer_map(buffer, &map, GST_MAP_READ);
  if (res) {
    inspect_frame_info(streamInspector, map.data, map.size, timestamp);
  }

  return GST_PAD_PROBE_HANDLED;
}

/**
 * 
 * This function is called when some SSRC becomes inactive,
 * so we send an EOS event to flush all buffered data and 
 * remove it from our HashTable.
 * 
 */
static void
on_pad_removed (GstElement * rtpbin, GstPad * pad, Inspector * inspector)
{   
  gchar *padName = gst_pad_get_name (pad);
  log_info("on_pad_removed: %s", padName);
  if (g_str_has_prefix(padName, "recv_rtp_src_")) {
    StreamInspector * streamInspector = g_hash_table_lookup(inspector->streams, padName);
    if (streamInspector) {
      gst_element_send_event(streamInspector->bin, gst_event_new_eos());
      g_hash_table_remove(inspector->streams, padName);
      g_free(streamInspector->ssrc);
      if (outputPath) {
        fclose(streamInspector->fdout);
      }
      free(streamInspector);
    }
  }
}

/**
 * 
 * This function is called when rtpbin detects a new SSRC.
 * We are using the padName as key of our HashTable.
 * 
 * For each new SSRC we basically build a new bin with
 * a queue and a rtpvp8depay element to receive
 * and lead with the RTP data.
 * 
 * To get the VP8 frames, we put a PROBE at "src" (or output)
 * pad from rtpvp8depay module. The VP8 frames are collected
 * in buffer_probe() function.
 * 
 * So basically we are using rtpbin to lead with the
 * RTP scenarios (packet loss, misordering, jitter) and
 * rtpvp8depay to put all packets frame together!
 * 
 * */
static void
on_pad_added (GstElement * rtpbin, GstPad * new_pad, gpointer data)
{
  GstPadLinkReturn ret;
  Inspector * inspector = (Inspector*) data;
  
  gchar *padName = gst_pad_get_name (new_pad);
  log_info("on_pad_added: %s", padName);
  if (!g_str_has_prefix(padName, "recv_rtp_src_")) {
    return; 
  }

  StreamInspector * streamInspector = stream_inspector_initialize(padName);

  GstElement * queue = gst_element_factory_make("queue", NULL);
  GstElement * depay = gst_element_factory_make("rtpvp8depay", NULL);
  
  GstPad * pad = gst_element_get_static_pad(depay, "src");
  gst_pad_add_probe(pad, GST_PAD_PROBE_TYPE_BUFFER, buffer_probe, streamInspector, NULL); 
  gst_object_unref (pad);

  gst_bin_add_many(GST_BIN(streamInspector->bin), queue, depay, NULL);
  gst_element_link_many(queue, depay, NULL);

  GstPad *queuePad = gst_element_get_static_pad (queue, "sink");
  GstPad *ghostPad = gst_ghost_pad_new ("sink", queuePad);
  gst_pad_set_active (ghostPad, TRUE);
  gst_element_add_pad (streamInspector->bin, ghostPad);
  gst_object_unref (queuePad);

  gst_bin_add(GST_BIN(inspector->pipeline), streamInspector->bin);

  GstPad *binSink = gst_element_get_static_pad (streamInspector->bin, "sink");
  ret = gst_pad_link (new_pad, binSink);
  if (GST_PAD_LINK_FAILED (ret)) {
    log_info("Type is '%s' but link failed.", padName);
    exit(ERROR_PIPELINE_LINK);
  } else {
    log_info("Link succeeded (type '%s').", padName);
    gst_element_sync_state_with_parent(streamInspector->bin);
  }
  gst_object_unref (binSink);  
  g_hash_table_insert(inspector->streams, padName, streamInspector);
}

/** 
 * 
 * This function is called for rtpbin to get the correct caps
 * from the payloadType detected. So you need to use --payloadType
 * to set the correct expected VP8 payload type.
 * 
*/
static GstCaps *
on_request_pt_map (GstElement * rtpbin, guint session_id, guint pt, gpointer user_data)
{
  GstCaps *caps = NULL;
  if (pt == payloadType) {
    caps = gst_caps_from_string("application/x-rtp,media=(string)video,encoding-name=(string)VP8,clock-rate=(int)90000");
  } 
  return caps;
}


/**
 * 
 * This function is called to return the input from the inspector.
 * It can be a pcap file or a realtime UDP source.
 * 
 */
GstElement *
get_rtp_source ()
{
  if (inputFile != NULL) {
    GstElement *bin = gst_bin_new(NULL);

    GstElement * filesrc = gst_element_factory_make("filesrc", NULL);
    g_object_set(filesrc, "location", inputFile, NULL);
    GstElement * parse = gst_element_factory_make("pcapparse", NULL);
    gst_bin_add_many(GST_BIN(bin), filesrc, parse, NULL);
    gst_element_link_many(filesrc, parse, NULL);

    GstPad * pad = gst_element_get_static_pad (parse, "src");
    GstPad * srcPad = gst_ghost_pad_new ("src", pad);
    gst_pad_set_active (srcPad, TRUE);
    gst_element_add_pad (bin, srcPad);
    gst_object_unref (pad);
    return bin;
  }

  GstElement * udpsrc = gst_element_factory_make("udpsrc", NULL);
  g_object_set(udpsrc, "port", port, NULL);

  GstCaps* rtpCaps = gst_caps_new_empty_simple ("application/x-rtp");
  g_object_set(udpsrc, "caps", rtpCaps, NULL);

  return udpsrc;
}


/**
 * 
 * This function create the basic GStreamer pipeline. 
 * This pipeline should be different according the used options:
 * 
 * (--port) => (udpsrc ! rtpbin)
 * (--file) => (filesrc ! pcapparse ! rtpbin)
 * 
 * It's important to remember that the others gst elements should be created 
 * dinamically when rtpbin detect a new SSRC. Pay attention at the on_pad_added() 
 * function!
 * 
 * */
Inspector* 
create_pipeline () 
{
  log_info("Creating inspector pipeline.");
  Inspector* inspector = calloc(1, sizeof(Inspector));
  inspector->pipeline = gst_element_factory_make("pipeline", NULL);

  inspector->rtpsrc = get_rtp_source();
  inspector->rtpbin = gst_element_factory_make("rtpbin", NULL);

  /* Setting "autoremove" option to clean our pipeline when some SSRC was inactived */
  g_object_set(inspector->rtpbin, "autoremove", TRUE, NULL);
  g_signal_connect(inspector->rtpbin, "request-pt-map", G_CALLBACK (on_request_pt_map), inspector);
  g_signal_connect(inspector->rtpbin, "pad-added", G_CALLBACK (on_pad_added), inspector);
  g_signal_connect(inspector->rtpbin, "pad-removed", G_CALLBACK (on_pad_removed), inspector);

  gst_bin_add_many(GST_BIN(inspector->pipeline), inspector->rtpsrc, inspector->rtpbin, NULL);
  if (!gst_element_link_pads(inspector->rtpsrc, "src", inspector->rtpbin, "recv_rtp_sink_0")) {
    log_info("Error at rtpsrc link with rtpbin");
    exit(ERROR_PIPELINE_LINK);
  }

  /* This HashTable is resposible by the SSRC/GstBin references */
  inspector->streams = g_hash_table_new(g_str_hash, g_str_equal);
  return inspector;
}

int 
main (int argc, char *argv[])
{
  GError * error = NULL;
  GOptionContext * context = g_option_context_new("- VP8 Frame Inspector");
  g_option_context_add_main_entries(context, entries, NULL);
  if (!g_option_context_parse(context, &argc, &argv, &error)) {
    log_info("Failed to parse the arguments");
    exit(ERROR_PARSE_ARGS);
  }

  if (inputFile == NULL && port <= 0) {
    log_info("Invalid port: %i", port);
    exit(ERROR_INVALID_ARGS);
  }

  /* The payload type should be in the dynamic range */
  if (payloadType < 96 || payloadType > 127) {
    log_info("PayloadType out of range %i [96-127]", payloadType);
    exit(ERROR_INVALID_ARGS);
  }

  /* Initialize GStreamer */
  gst_init (&argc, &argv);
  log_info("Initializing VP8 Frame Inspector");

  /* Here is where we create the "basic" GStreamer pipeline */
  Inspector *inspector = create_pipeline();

  GstBus *bus = gst_element_get_bus(inspector->pipeline);  
  guint bus_watch_id = gst_bus_add_watch(bus, bus_handler, inspector);
  gst_object_unref(bus);
  
  /* Start playing */
  gst_element_set_state (inspector->pipeline, GST_STATE_PLAYING);
  
  inspector->loop = g_main_loop_new(NULL, FALSE);

  /* Adding a signal handle to handle SIGINT*/
  log_info("Adding the signal handler");
  g_unix_signal_add(SIGINT, signal_handler, inspector);

  log_info("Starting VP8 Frame Inspector");
  g_main_loop_run(inspector->loop);

  log_info("VP8 Frame Inspector is done.");
  gst_element_set_state(inspector->pipeline, GST_STATE_NULL);
  gst_object_unref(inspector->pipeline);

  g_source_remove(bus_watch_id);
  g_main_loop_unref(inspector->loop);

  return EXIT_SUCCESS;
}