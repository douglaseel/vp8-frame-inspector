#include <glib-unix.h>
#include <gst/gst.h>

enum 
{
  VP8_CODEC_OK = 0,
  VP8_CODEC_CORRUPT_FRAME = 1,
  VP8_CODEC_UNSUP_BITSTREAM = 2
};

enum
{
  FRAME_HEADER_SZ = 3,
  KEYFRAME_HEADER_SZ = 7
};

enum
{
  MB_FEATURE_TREE_PROBS = 3,
  MAX_MB_SEGMENTS = 4
};

enum
{
  BLOCK_CONTEXTS = 4
};


typedef struct {
  guint width;
  guint widthScale;
  guint height;
  guint heightScale;
} FrameResolution;

typedef struct
{
  gboolean ok;
  gboolean keyframe;
  guint version;
  gboolean isExperimental;
  gboolean showFrame;
  guint partSize;
  FrameResolution resolution;
  gboolean refreshGoldenFrame;
  gboolean refreshAltrefFrame;

  GstClockTime pts;
  guint frameNumber;
} FrameInfo;


guint vp8_parse_frame_header(const unsigned char * data, const unsigned int len, FrameInfo * ctx);
guint vp8_parse_segmentation_header(struct bool_decoder *bool);
guint vp8_parse_loopfilter_header(struct bool_decoder *bool);
guint vp8_parse_partitions(struct bool_decoder *bool);
guint vp8_parse_quantizer_header(struct bool_decoder *bool);
guint vp8_parse_reference_header(struct bool_decoder *bool, FrameInfo * ctx);