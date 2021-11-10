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
* `glib-2.0`
* `gstreamer`, `gst-plugins-base`, `gst-plugins-good`, `gst-plugins-bad` and gstreamer dev package (>= 1.18.x).

A few examples of installation:

* MacOS BigSur (Version 11.6, x86)

```
brew install make gcc gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-devtools
```

* Debian 11

```
sudo apt-get install make gcc libgstreamer1.0-0 libgstreamer1.0-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-tools
```

## Build

```
make
```

This command will build and create the binary that should be available at `out/inspector`.


## Run tests

```
make test
```

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
$ ./out/inspector --port=55555 --payloadType=105 --outputPath="../inspector-results"
```

For each new `SSRC` detected by `inspector` tool, a new file will be created with the results in the `outputPath` folder with `<SSRC>.log` name. 
So, basically, we will have `N` files for `N` streams.


### PCAP inspection

You also can use the `inspector` to inspect one or more VP8 streams in a PCAP file. To do it, use the `--file <PCAP_FILE>` option. See the example:

```
$ ./out/inspector --file sample.pcap --payloadType=105 --outputPath="../inspector-results"
```

The results will be respect the same logic than the realtime inspection.

### Output format

The output format follows this pattern:

```
ssrc: 240336986, frame: 0, pts: 0, ok: 1, keyframe: 1, show: 1, width: 320, height: 240, refreshGoldenFrame: 1, refreshAltrefFrame: 1 
ssrc: 240336986, frame: 1, pts: 33, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 2, pts: 66, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 3, pts: 99, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 4, pts: 131, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 5, pts: 163, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 6, pts: 196, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
ssrc: 240336986, frame: 7, pts: 228, ok: 1, keyframe: 0, show: 1, width: 320, height: 240, refreshGoldenFrame: 0, refreshAltrefFrame: 0 
...
```

Where we have one frame inspection per line with the fields:

- `ssrc`: synchronization source identifier from RTP packets (it's the only way to differ multiple results when we are using `--stdout` options);
- `frame`: frame number. It always start with 0 (see (here)[../HISTORY.md]);
- `pts`: presentation timestamp in miliseconds. It always start with 0 (see (here)[../HISTORY.md]);
- `ok`:  value `1` represents a good frame and `0` a invalid one;
  - It's already detect a few types of broken frames;
- `keyframe`: if this is a keyframe or not;
- `show`: if this frame should be displayed or not;
- `width`: frame width;
- `height`: frame height;
- `refreshGoldenFrame`: if this frame should update the golden frame or not;
- `refreshAltrefFrame`: if this frame should update the altref frame or not;
