#include "bool_decoder.h"
#include "vp8_parser.h"

int
vp8_parse_frame_header(const unsigned char * data, const unsigned int len, FrameInfo * frameCtx)
{
  guint tmp;

  if (len < 10) {
    return VP8_CODEC_CORRUPT_FRAME;
  }

  tmp = (data[2] << 16) | (data[1] << 8) | data[0];

  frameCtx->keyframe = !(tmp & 0x1);
  frameCtx->version = (tmp >> 1) & 0x7;
  frameCtx->showFrame = (tmp >> 4) & 0x1;
  frameCtx->partSize = (tmp >> 5) & 0x7FFFF;

  if (len <= frameCtx->partSize + (frameCtx->keyframe ? 10 : 3)) {
    return VP8_CODEC_CORRUPT_FRAME;
  }

  if (frameCtx->keyframe) {
    /* Keyframe header consists of a three-byte sync code
    * followed by the width and height and associated scaling
    * factors.
    */
    if (data[3] != 0x9d || data[4] != 0x01 || data[5] != 0x2a) {
      return VP8_CODEC_UNSUP_BITSTREAM;
    }

    tmp = (data[7] << 8) | data[6];
    frameCtx->resolution.width = tmp & 0x3FFF;
    frameCtx->resolution.widthScale = tmp >> 14;

    tmp = (data[9] << 8) | data[8];
    frameCtx->resolution.height = tmp & 0x3FFF;
    frameCtx->resolution.heightScale = tmp >> 14;
  }

  return VP8_CODEC_OK;
}

void
vp8_parse_segmentation_header(struct bool_decoder *bool)
{      
  int segmentationEnabled = bool_get_bit(bool);

  if (segmentationEnabled) {
    int i;
    int updateMap = bool_get_bit(bool);
    int updateData = bool_get_bit(bool);
    if (updateData) {
      /*hdr->abs = */bool_get_bit(bool);
      for (i = 0; i < MAX_MB_SEGMENTS; i++)
        /*hdr->quant_idx[i] = */bool_maybe_get_int(bool, 7);

      for (i = 0; i < MAX_MB_SEGMENTS; i++)
        /*hdr->lf_level[i] = */bool_maybe_get_int(bool, 6);
    }

    if (updateMap) {
      for (i = 0; i < MB_FEATURE_TREE_PROBS; i++) {
        /*hdr->tree_probs[i] = */bool_get_bit(bool) ? bool_get_uint(bool, 8) : 255;
      }
    }
  }
}

void
vp8_parse_loopfilter_header(struct bool_decoder * bool)
{
  bool_get_bit(bool); // filter_type
  bool_get_uint(bool, 6); // loop_filter_level
  bool_get_uint(bool, 3); // sharpness_level
  int deltaEnabled = bool_get_bit(bool);
  if (deltaEnabled && bool_get_bit(bool)) {
    int i;
    for (i = 0; i < BLOCK_CONTEXTS; i++)
      bool_maybe_get_int(bool, 6); // ref_frame_delta_update_flag + delta_magnitude + delta_sign

    for (i = 0; i < BLOCK_CONTEXTS; i++)
      bool_maybe_get_int(bool, 6); // mb_mode_delta_update_flag + delta_magnitude + delta_sign
  }
}

void
vp8_parse_partitions(struct bool_decoder * bool)
{
  // NOTE: we should compare the buffer data size with the partitions, because we can find a corrupted frame!
  bool_get_uint(bool, 2); // log2_nbr_of_dct_partitions
}

void
vp8_parse_quantizer_header(struct bool_decoder * bool)
{
  bool_get_uint(bool, 7); // y_ac_qi
  bool_maybe_get_int(bool, 4); // y1_dc_delta_q
  bool_maybe_get_int(bool, 4); // y2_dc_delta_q
  bool_maybe_get_int(bool, 4); // y2_ac_delta_q
  bool_maybe_get_int(bool, 4); // uv_dc_delta_q
  bool_maybe_get_int(bool, 4); // uv_ac_delta_q
}

void
vp8_parse_reference_header(struct bool_decoder * bool, FrameInfo * ctx)
{
  ctx->refreshGoldenFrame = ctx->keyframe ? TRUE : bool_get_bit(bool);
  ctx->refreshAltrefFrame = ctx->keyframe ? TRUE : bool_get_bit(bool);
}