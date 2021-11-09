# Simple VP8 Frame Inspector 

This is a project about a simple VP8 Frame Inspector tool that can extract some frame infos, such as:

- Frame number;
- Frame presentation time;
- Frame resolution (width and height);
- Frame type: keyframe or interframe;
- This frame should be displayed or not;
- This frame will modify the golden frame;
- This frame will modify the altref frame;


This repo is divided in two parts:

- `inspector` folder: this folder contains all inspector code and info about how to build and use it;
- `server` and `client` folders: these folders contains the sample that shows how to use the **inspector** tool to inspect VP8 frames in realtime conferences using a very simple conference server based on `mediasoup`.


## Getting started


## Next steps

* Add automated tests;
* Detect corrupted frames comparing the frame size with the partitions size;
* Extract more info about the frame (ex: );
* Evaluate how `packet loss` could affect the frame itself
  * Probably we need to look `rtpvp8depay` code more deeper to better undestanding
* Add RTSP support for realtime capture;
* Add a filter options to capture only specific scenarios (ex.: corrupted frames, unsupported bitstream, etc);
* Replace the current `vp8_parser` code to libvpx or similar (intel libva maybe?);
* Add support for others video codecs like H264, VP9 and AV1;
* Add support for IVF files (https://wiki.multimedia.cx/index.php/IVF);
* Add `--stdin` flag to read the input data directly from stdin;
* Transform that `server/src/inspector.ts` in one node module to simplify the integration with other solutions;