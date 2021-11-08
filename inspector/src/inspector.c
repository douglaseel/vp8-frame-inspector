#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <glib-unix.h>
#include <gst/gst.h>

#include "bool_decoder.h"
#include "vp8_parser.h"

#define FAILED_TO_PARSE_ARGS 2
#define FAILED_TO_LINK_PADS 3

typedef struct
{
  GMainLoop *loop;
  GstElement *pipeline;
  GstElement *rtpsrc;
  GstElement *depay;
  GstElement *appsink;
  gboolean closing;
  gboolean ready;
  GstClockTime ptsOffset;
  guint frameNumber;
} Worker;



static gint64 rtpPort = -1;

static GOptionEntry entries[] =
{
  { "rtpPort", 'p', 0, G_OPTION_ARG_INT64, &rtpPort, "port to receive rtp stream", "60000" },
  { NULL }
};

void
log_info (gchar *str, ...) 
{
  gchar *info = g_strdup_printf("analyzer: %s\n", str);
  va_list arg;
  va_start(arg, str);
  vfprintf(stderr, info, arg);
  va_end(arg);
  g_free(info);
}

gboolean
signal_handler (gpointer data)
{
  Worker * worker = (Worker *)data;
  if (!worker->closing) {
    log_info("signal_handler: received a SIGINT, emitting EOS event to pipeline");
    gst_element_send_event(worker->pipeline, gst_event_new_eos ());
    worker->closing = TRUE;
  } else {
    g_main_loop_quit(worker->loop);
  }
  return TRUE;
}

static gboolean
bus_handler (GstBus * bus, GstMessage * message, gpointer data)
{
  Worker * worker = (Worker *)data;
  switch (GST_MESSAGE_TYPE(message)) {
    case GST_MESSAGE_EOS : {
      if (worker->closing) {
        log_info("bus_handler: received EOS when pipeline was closing, stopping pipeline now");
        g_main_loop_quit(worker->loop);
      }
      break;
    }
    case GST_MESSAGE_STATE_CHANGED : {
      // we only care about pipeline state change messages
      if (GST_MESSAGE_SRC (message) == GST_OBJECT_CAST (worker->pipeline)) {
        GstState old, new, pending;
        gst_message_parse_state_changed (message, &old, &new, &pending);
        if (new == GST_STATE_PLAYING && worker->ready == FALSE) {
          log_info("bus_handler: pipeline is ready");
          fprintf(stdout, "{ \"event\": \"ready\" }\n");
          fflush(stdout);
          worker->ready = TRUE;
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
dump_frame_info (FrameInfo * ctx)
{
  log_info("[ pts:%" G_GUINT64_FORMAT ", frame: %u, keyframe: %u, showFrame: %u, refreshGoldenFrame: %u, refreshAltrefFrame: %u ]", 
    GST_TIME_AS_MSECONDS(ctx->pts), ctx->frameNumber, ctx->keyframe, ctx->showFrame, ctx->refreshGoldenFrame, ctx->refreshAltrefFrame);

  if (ctx->keyframe) {
    log_info("[ width: %u, widthScale: %u, height: %u, heightScale: %u ]", 
      ctx->resolution.width, ctx->resolution.widthScale, ctx->resolution.height, ctx->resolution.heightScale);
  }
}



static GstPadProbeReturn
buffer_probe(GstPad * pad, GstPadProbeInfo * info, gpointer data)
{ 
  GstMapInfo map;
  GstBuffer * buffer = gst_pad_probe_info_get_buffer(info);
  Worker * worker = (Worker*) data;
  //if (!GST_BUFFER_FLAG_IS_SET(buffer, GST_BUFFER_FLAG_DELTA_UNIT)) {
    GstClockTime bufferTimestamp = GST_BUFFER_DTS_OR_PTS(buffer);
    // NOTE: The buffer clock time is relative to pipeline start time, so we are marking the offset
    if (worker->ptsOffset == 0) {
      worker->ptsOffset = bufferTimestamp;
    }

    GstClockTime timestamp = bufferTimestamp - worker->ptsOffset;
    int res = gst_buffer_map(buffer, &map, GST_MAP_READ);
    if (res) {
      FrameInfo frameCtx;
      struct bool_decoder bool;

      FrameInfo * ctx = &frameCtx;

      ctx->pts = timestamp;
      ctx->frameNumber = worker->frameNumber++;

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

      dump_frame_info(ctx);
    }
  //}
  return GST_PAD_PROBE_OK;
}

Worker* 
create_pipeline () 
{
  log_info("create_pipeline");
  Worker* worker = calloc(1, sizeof(Worker));
  worker->pipeline = gst_element_factory_make("pipeline", NULL);

  worker->rtpsrc = gst_element_factory_make("udpsrc", NULL);
  g_object_set(worker->rtpsrc, "port", rtpPort, NULL);

  GstCaps* rtpCaps = gst_caps_new_empty_simple ("application/x-rtp");
  g_object_set(worker->rtpsrc, "caps", rtpCaps, NULL);

  worker->depay = gst_element_factory_make("rtpvp8depay", NULL);
  GstPad *pad = gst_element_get_static_pad(worker->depay, "src");
  gst_pad_add_probe(pad, GST_PAD_PROBE_TYPE_BUFFER, buffer_probe, worker, NULL); 
  gst_object_unref (pad);

  worker->appsink = gst_element_factory_make("fakesink", NULL);

  gst_bin_add_many(GST_BIN(worker->pipeline),
    worker->rtpsrc, worker->depay, worker->appsink, NULL);

  if (!gst_element_link_many(worker->rtpsrc, worker->depay, worker->appsink, NULL)) {
    log_info("create_pipeline: failed to sink rtp and/or rtcp source with rtpBin ");
    exit(FAILED_TO_LINK_PADS);
  }

  worker->closing = FALSE;
  worker->ready = FALSE;
  worker->ptsOffset = 0;
  worker->frameNumber = 0;

  return worker;
}

int 
main (int argc, char *argv[])
{
  GError * error = NULL;
  GOptionContext * context = g_option_context_new("- VP8 analyzer");
  g_option_context_add_main_entries(context, entries, NULL);
  if (!g_option_context_parse(context, &argc, &argv, &error)) {
    log_info("main: failed to parse the arguments");
    exit(FAILED_TO_PARSE_ARGS);
  }

  if (rtpPort <= 0) {
    log_info("main: invalid rtpPort");
    exit(FAILED_TO_PARSE_ARGS);
  }

  /* Initialize GStreamer */
  gst_init (&argc, &argv);
  log_info("main: creating gstreamer pipeline");
  Worker *worker = create_pipeline();

  GstBus *bus = gst_element_get_bus(worker->pipeline);  
  guint bus_watch_id = gst_bus_add_watch(bus, bus_handler, worker);
  gst_object_unref(bus);
  
  /* Start playing */
  gst_element_set_state (worker->pipeline, GST_STATE_PLAYING);
  
  worker->loop = g_main_loop_new(NULL, FALSE);

  log_info("main: registering signal handler...");
  g_unix_signal_add(SIGINT, signal_handler, worker);

  log_info("main: starting pipeline...");
  g_main_loop_run(worker->loop);

  log_info("main: done, removing pipeline");
  gst_element_set_state(worker->pipeline, GST_STATE_NULL);
  gst_object_unref(worker->pipeline);

  g_source_remove(bus_watch_id);
  g_main_loop_unref(worker->loop);

  return EXIT_SUCCESS;
}