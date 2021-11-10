# VP8 Frame Inspector

The `inspector` is a CLI tool to extract some info about VP8 frames. 
It can be used for inspecting realtime or captured RTP VP8 data;

The `inspector` basically does:
  * Create a GStreamer pipeline that:
    * receive the RTP data (from a UDP socket or PCPA file); and
    * extract the VP8 frames from the RTP;
  * Inspect each VP8 frame, extracting the desired info;
  * Throws those info to files and stdout (if setted);

## Dependencies

#### MacOS BigSur (Version 11.6, x86)

```
brew install make gcc gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-devtools
```

#### Debian 11

```
sudo apt-get install make gcc libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-tools
```

## Build

```
make
```

This command will build and create the binary that will be available at `out/inspector`.


## Usage

You can exec `inspector --help` command to see all available options.

```
$ ./out/inspector --help
Usage:
  inspector [OPTION?] - VP8 Frame Inspector

Help Options:
  -h, --help                            Show help options

Application Options:
  -p, --port=50000                      Port to receive rtp stream
  -t, --payloadType=96                  Expected VP8 Payload Type [96-127]
  -f, --file=./sample.pcap              PCAP file as source
  -o, --outputPath=./inspector-results  Path to inspector results
  --stdout                              Send the inspector results to stdout
```

**IMPORTANT**: the path in `--outputPath` option should already exist and the user should has write permission. You must not add the `/` in the end of the path.


### a. Realtime analysis

When we use this command

```
$ ./out/inspector --port=<UDP_PORT> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

the `inspector` will listening the UDP `UDP_PORT` for RTP packets with the payload `VP8_PAYLOAD_TYPE`.
For each new `SSRC` detected by `inspector` tool, a new file will be created with the results in the `PATH_TO_RESULTS` folder with `<SSRC>.log` name. 
So, basically, we will have `N` files for `N` streams


### b. PCAP analysis

To inspect the VP8 frames for one or more streams in a PCAP file use:

```
$ ./out/inspector --file <PCAP_FILE> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

The result will be respect the same logic than realtime analysis.



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