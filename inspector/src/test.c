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
keyframe_test_001 (void) 
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

  int partSize = 12484;
  int width = 1280;
  int height = 720;
  unsigned int len = partSize + KEYFRAME_HEADER_SZ + FRAME_HEADER_SZ + 1;

  printf("- Keyframe test 001\n");
  test_bool("Should parse the frame header", !vp8_parse_frame_header(data, len, &frame));
  test_bool("Should detect a keyframe", frame.keyframe);
  test_bool("Should be display", frame.showFrame);
  test_bool("Should get the correct version", frame.version == 0);
  test_bool("Should get the correct header size", frame.partSize == partSize);
  test_bool("Should get the correct width", frame.resolution.width == width);
  test_bool("Should get the correct height", frame.resolution.height == height);
}

int
main (int argc, char *argv[]) 
{
  keyframe_test_001();

  return 0;
}
