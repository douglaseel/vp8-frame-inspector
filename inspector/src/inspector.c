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

static GOptionEntry entries[] =
{
  { "port", 'p', 0, G_OPTION_ARG_INT, &port, "Port to receive rtp stream", "50000" },
  { "payloadType", 't', 0, G_OPTION_ARG_INT, &payloadType, "Expected VP8 Payload Type [96-127]", "96" },
  { "outputPath", 'o', 0, G_OPTION_ARG_STRING, &outputPath, "Path to inspector logs", "./inspector-logs" },
  { "inputFile", 0, 0, G_OPTION_ARG_STRING, &inputFile, "PCAP file as source", "./sample.pcap" },
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

gboolean
signal_handler (gpointer data)
{
  Inspector * inspector = (Inspector *)data;
  if (!inspector->closing) {
    log_info("signal_handler: received a SIGINT, emitting EOS event to pipeline");
    gst_element_send_event(inspector->pipeline, gst_event_new_eos ());
    inspector->closing = TRUE;
  } else {
    g_main_loop_quit(inspector->loop);
  }
  return TRUE;
}

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
          fprintf(stdout, "{ \"event\": \"ready\" }\n");
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

void
dump_frame_info (FILE *fdout , FrameInfo * ctx)
{
  log_info("[ pts:%" G_GUINT64_FORMAT ", frame: %u, keyframe: %u, showFrame: %u, refreshGoldenFrame: %u, refreshAltrefFrame: %u ]", 
    GST_TIME_AS_MSECONDS(ctx->pts), ctx->frameNumber, ctx->keyframe, ctx->showFrame, ctx->refreshGoldenFrame, ctx->refreshAltrefFrame);

  if (ctx->keyframe) {
    log_info("[ width: %u, widthScale: %u, height: %u, heightScale: %u ]", 
      ctx->resolution.width, ctx->resolution.widthScale, ctx->resolution.height, ctx->resolution.heightScale);
  }

  fprintf(fdout, "frameNumber: %u, pts: %" G_GUINT64_FORMAT ", isKeyframe: %u, show: %u, width: %u, height: %u, refreshGoldenFrame: %u, refreshAltrefFrame: %u \n",
    ctx->frameNumber, GST_TIME_AS_MSECONDS(ctx->pts), ctx->keyframe, ctx->showFrame,  ctx->resolution.width, ctx->resolution.height, 
    ctx->refreshGoldenFrame, ctx->refreshAltrefFrame);
}

static GstPadProbeReturn
buffer_probe(GstPad * pad, GstPadProbeInfo * info, gpointer data)
{ 
  GstMapInfo map;
  GstBuffer * buffer = gst_pad_probe_info_get_buffer(info);
  StreamInspector * streamInspector = (StreamInspector*) data;
  //if (!GST_BUFFER_FLAG_IS_SET(buffer, GST_BUFFER_FLAG_DELTA_UNIT)) {
    GstClockTime bufferTimestamp = GST_BUFFER_DTS_OR_PTS(buffer);
    // NOTE: The buffer clock time is relative to pipeline start time, so we are marking the offset
    if (streamInspector->ptsOffset == 0) {
      streamInspector->ptsOffset = bufferTimestamp;
    }

    GstClockTime timestamp = bufferTimestamp - streamInspector->ptsOffset;
    int res = gst_buffer_map(buffer, &map, GST_MAP_READ);
    if (res) {
      FrameInfo frameCtx;
      struct bool_decoder bool;

      FrameInfo * ctx = &frameCtx;

      memset(&frameCtx, 0, sizeof(frameCtx));

      ctx->pts = timestamp;
      ctx->frameNumber = streamInspector->frameNumber++;

      unsigned char * data = map.data;
      unsigned int size = map.size;

      // initialize
      vp8_parse_frame_header(data, size, ctx);

      data += FRAME_HEADER_SZ;
      size -= FRAME_HEADER_SZ;
      if (ctx->keyframe)
      {
        data += KEYFRAME_HEADER_SZ;
        size -= KEYFRAME_HEADER_SZ;
      }

      init_bool_decoder(&bool, data, ctx->partSize);

      /* Skip the colorspace and clamping bits */
      if (ctx->keyframe) {
        bool_get_uint(&bool, 2);
      }

      vp8_parse_segmentation_header(&bool);
      vp8_parse_loopfilter_header(&bool);
      vp8_parse_partitions(&bool);
      vp8_parse_quantizer_header(&bool);
      vp8_parse_reference_header(&bool, ctx);

      dump_frame_info(streamInspector->fdout, ctx);
    }
  //}
  return GST_PAD_PROBE_HANDLED;
}

StreamInspector *
stream_inspector_initialize (gchar * padName) {
  log_info("stream_inspector_initialize [padName: %s]", padName);

  StreamInspector * streamInspector = (StreamInspector *) malloc(1 * sizeof(StreamInspector));
  gchar **split = g_strsplit(padName, "_", 0);
  gchar *ssrc = split[4];
  gchar *pt = split[5];

  streamInspector->bin = gst_bin_new(NULL);
  streamInspector->ssrc = g_strdup_printf("%s", ssrc);
  streamInspector->ptsOffset = 0;
  streamInspector->frameNumber = 0;

  gchar * filename = g_strdup_printf("%s/%s.log", outputPath, ssrc);
  streamInspector->fdout = fopen(filename, "w");

  g_object_set(streamInspector->bin, "message-forward", TRUE, NULL);

  g_free(filename);
  g_strfreev(split);
  return streamInspector;
}


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
      fclose(streamInspector->fdout);
      free(streamInspector);
    }
  }
}

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

  GstCaps * padCaps = gst_pad_get_current_caps(new_pad);
  GstStructure * capsStruct = gst_caps_get_structure (padCaps, 0);

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

static GstCaps *
on_request_pt_map (GstElement * rtpbin, guint session_id, guint pt, gpointer user_data)
{
  GstCaps *caps = NULL;
  if (pt == payloadType) {
    caps = gst_caps_from_string("application/x-rtp,media=(string)video,encoding-name=(string)VP8,clock-rate=(int)90000");
  } 
  return caps;
}

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

Inspector* 
create_pipeline () 
{
  log_info("Creating inspector pipeline.");
  Inspector* inspector = calloc(1, sizeof(Inspector));
  inspector->pipeline = gst_element_factory_make("pipeline", NULL);

  inspector->rtpsrc = get_rtp_source();
  inspector->rtpbin = gst_element_factory_make("rtpbin", NULL);
  g_object_set(inspector->rtpbin, "autoremove", TRUE, NULL);
  g_signal_connect(inspector->rtpbin, "request-pt-map", G_CALLBACK (on_request_pt_map), inspector);
  g_signal_connect(inspector->rtpbin, "pad-added", G_CALLBACK (on_pad_added), inspector);
  g_signal_connect(inspector->rtpbin, "pad-removed", G_CALLBACK (on_pad_removed), inspector);

  gst_bin_add_many(GST_BIN(inspector->pipeline), inspector->rtpsrc, inspector->rtpbin, NULL);
  if (!gst_element_link_pads(inspector->rtpsrc, "src", inspector->rtpbin, "recv_rtp_sink_0")) {
    log_info("Error at rtpsrc link with rtpbin");
    exit(ERROR_PIPELINE_LINK);
  }

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
    log_info("main: failed to parse the arguments");
    exit(ERROR_PARSE_ARGS);
  }

  if (inputFile == NULL && port <= 0) {
    log_info("Invalid port: %i", port);
    exit(ERROR_INVALID_ARGS);
  }

  if (payloadType < 96 || payloadType > 127) {
    log_info("PayloadType out of range %i [96-127]", payloadType);
    exit(ERROR_INVALID_ARGS);
  }

  /* Initialize GStreamer */
  gst_init (&argc, &argv);
  log_info("Initializing VP8 Frame Inspector");
  Inspector *inspector = create_pipeline();

  GstBus *bus = gst_element_get_bus(inspector->pipeline);  
  guint bus_watch_id = gst_bus_add_watch(bus, bus_handler, inspector);
  gst_object_unref(bus);
  
  /* Start playing */
  gst_element_set_state (inspector->pipeline, GST_STATE_PLAYING);
  
  inspector->loop = g_main_loop_new(NULL, FALSE);

  log_info("Confinguring the signal handler");
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