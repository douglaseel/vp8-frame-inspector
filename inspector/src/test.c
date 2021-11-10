#include <stdio.h>
#include "vp8_parser.h"

void
test_bool (const char * msg, const int bool) {
  printf("-- %s", msg);
  if (!bool) {
    printf(" - FAILED! \n");
    exit(1);
  }
  printf(" - OK!\n");
}

void
frame_header_test_001 (void) 
{
  // is a keyframe
  FrameInfo frame;
  unsigned char data[] = { 
    0b10010000, // keyframe = true, version = 0, display = true
    0b00011000, 
    0b00000110, // partSize = 12484
    0x9d, 0x01, 0x2a, // sync code
    0x00, 0x05, // width = 0x0500 & 0x3fff = 1280
    0xd0, 0x02, // height = 0x02d0 & 0x3fff = 720
  };

  int version = 0;
  int partSize = 12484;
  int width = 1280;
  int height = 720;
  unsigned int len = partSize + KEYFRAME_HEADER_SZ + FRAME_HEADER_SZ + 1;

  printf("- Keyframe without horizontal and vertical scaling \n");
  test_bool("Should parse the frame header", vp8_parse_frame_header(data, len, &frame) == VP8_CODEC_OK);
  test_bool("Should detect a keyframe", frame.keyframe);
  test_bool("Should be display", frame.showFrame);
  test_bool("Should get the correct version", frame.version == version);
  test_bool("Should get the correct header size", frame.partSize == partSize);
  test_bool("Should get the correct width", frame.resolution.width == width);
  test_bool("Should get the correct height", frame.resolution.height == height);
  printf("\n");
}

void
frame_header_test_002 (void) 
{
  // is a keyframe
  FrameInfo frame;
  unsigned char data[] = { 
    0b10010010, // keyframe = true, version = 1, display = true
    0b00011000, 
    0b00000110, // partSize = 12484
    0x9d, 0x01, 0x2a, // sync code
    0x00, 0x45, // width = 0x4500 & 0x3fff = 1280
    0xd0, 0x42, // height = 0x42d0 & 0x3fff = 720
  };

  int version = 1;
  int partSize = 12484;
  int width = 1280;
  int height = 720;
  unsigned int len = partSize + KEYFRAME_HEADER_SZ + FRAME_HEADER_SZ + 1;

  printf("- Keyframe with horizontal and vertical scaling \n");
  test_bool("Should parse the frame header", vp8_parse_frame_header(data, len, &frame) == VP8_CODEC_OK);
  test_bool("Should detect a keyframe", frame.keyframe);
  test_bool("Should be display", frame.showFrame);
  test_bool("Should get the correct version", frame.version == version);
  test_bool("Should get the correct header size", frame.partSize == partSize);
  test_bool("Should get the correct width", frame.resolution.width == width);
  test_bool("Should get the correct height", frame.resolution.height == height);
  printf("\n");
}

void
frame_header_test_003 (void) 
{
  // is a keyframe
  FrameInfo frame;
  unsigned char data[] = { 
    0b10010010, // keyframe = true, version = 1, display = true
    0b00011000, 
  };

  unsigned int len = 2;

  printf("- Frame corrupted \n");
  test_bool("Should fail to parse the frame header", vp8_parse_frame_header(data, len, &frame) == VP8_CODEC_CORRUPT_FRAME);
  printf("\n");
}

void
frame_header_test_004 (void) 
{
  // is a keyframe
  FrameInfo frame;
  unsigned char data[] = { 
    0b10010010, // keyframe = true, version = 1, display = true
    0b00011000, 
    0b00000110, // partSize = 12484
    0x9f, 0x01, 0x2a, // wrong sync code
    0x00, 0x45, // width = 0x4500 & 0x3fff = 1280
    0xd0, 0x42, // height = 0x42d0 & 0x3fff = 720
  };

  int partSize = 12484;
  unsigned int len = partSize + KEYFRAME_HEADER_SZ + FRAME_HEADER_SZ + 1;

  printf("- Unsupported sync code 0x9f012a \n");
  test_bool("Should fail to parse the frame header", vp8_parse_frame_header(data, len, &frame) == VP8_CODEC_UNSUP_BITSTREAM);
  printf("\n");
}

int
main (int argc, char *argv[]) 
{
  frame_header_test_001();
  frame_header_test_002();
  frame_header_test_003();
  frame_header_test_004();
  return 0;
}
