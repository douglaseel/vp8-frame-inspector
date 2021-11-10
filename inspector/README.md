# VP8 Frame Inspector

The `inspector` is a CLI tool to extract some info about VP8 frames. 
It can be used for inspecting realtime or captured RTP VP8 data;

The `inspector` basically does:
  * Create a GStreamer pipeline that:
    * receive the RTP data (from a UDP socket or PCPA file); and
    * extract the VP8 frames from the RTP;
  * Inspect each VP8 frame, extracting the desired info (according https://datatracker.ietf.org/doc/html/rfc6386);
  * Throws those info to files and stdout (if setted);

## Dependencies

The deps are:
* `make`
* `gcc`
* `pkg-config`
* `gstreamer`, `gst-plugins-base`, `gst-plugins-good`, `gst-plugins-bad` and gstreamer dev package.

A few examples of installation:

* MacOS BigSur (Version 11.6, x86)

```
brew install make gcc gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-devtools
```

* Debian 11

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

**IMPORTANT**: the path in `--outputPath` option should already exist and the user should has write permission (don't add the `/` in the end of the path)


### Realtime inspection

To inspect realtime streaming, you should use the `--port <PORT>` option to do the `inspector` listening for RTP packages in that port.

```
$ ./out/inspector --port=<UDP_PORT> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

For each new `SSRC` detected by `inspector` tool, a new file will be created with the results in the `<PATH_TO_RESULTS>` folder with `<SSRC>.log` name. 
So, basically, we will have `N` files for `N` streams.


### PCAP inspection

You also can use the `inspector` to inspect one or more VP8 streams in a PCAP file. To do it, use the `--file <PCAP_FILE>` option. See the example:

```
$ ./out/inspector --file <PCAP_FILE> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

The results will be respect the same logic than the realtime inspection.
