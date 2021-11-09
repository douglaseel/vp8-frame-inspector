# VP8 Frame Inspector

The **inspector** is a CLI tool to extract some info about VP8 frames. 
We can use it for realtime listening RTP packets and non-realtime analysis providing a PCAP file as input.


## 1. Dependencies

#### MacOS BigSur (Version 11.6, x86)

```
brew install make gcc gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-devtools
```

#### Debian 11

```
sudo apt-get install make gcc libgstreamer1.0-0 gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-tools
```

## 2. Build

```
make
```

This command will build and create the binary that will be available at `out/inspector`.


## 3. Use

The **inspector** has a `--help` command that show all available options.]

```
$ ./out/inspector --help
Usage:
  inspector [OPTION?] - VP8 Frame Inspector

Help Options:
  -h, --help                            Show help options

Application Options:
  -p, --port=50000                      Port to receive rtp stream
  -t, --payloadType=96                  Expected VP8 Payload Type [96-127]
  -o, --outputPath=./inspector-logs     Path to inspector logs
  --inputFile=./sample.pcap             PCAP file as source
```

**IMPORTANT**: the path in `--outputPath` option should already exist and the user that will run the tool should have permission to write there. You must not add the `/` in the end of the path.


### a. Realtime analysis

When we use this command

```
$ ./out/inspector --port=<UDP_PORT> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

the **inspector** will listening the UDP `UDP_PORT` for RTP packets with the payload `VP8_PAYLOAD_TYPE`.
For each new `SSRC` detected by **inspector** tool, a new file will be created with the results in the `PATH_TO_RESULTS` folder with `<SSRC>.log` name. 
So, basically, we will have `N` files for `N` streams


### b. PCAP analysis

To inspect the VP8 frames for one or more streams in a PCAP file use:

```
$ ./out/inspector --file <PCAP_FILE> --payloadType=<VP8_PAYLOAD_TYPE> --outputPath=<PATH_TO_RESULTS>
```

The result will be respect the same logic than realtime analysis.