# Simple VP8 Frame Inspector 

This is a project about a simple VP8 Frame Inspector tool that can extract some frame infos, such as:

- Frame number;
- Frame presentation time;
- Frame resolution (width and height);
- Frame type: keyframe or interframe;
- This frame should be displayed or not;
- This frame will modify the golden frame;
- This frame will modify the altref frame;


This repo is divided in two folders:

- `inspector`: contains all `inspector` code, info about how to build and use it;
- `sample`: contains the sample that shows how to use the `inspector` tool to inspect VP8 frames in realtime conferences using a very simple conference server based on `mediasoup`. This sample is divided into two parts:
  - `server`: a very simple conference service that uses `mediasoup`
  - `client`: a VERY VERY VERY simple and **ugly** react app to interact with the server and do the meetings

## Getting started

This repo has a few more docs, we recommend that you read them before continue:

1. `inspector` documentation (see [here](inspector/README.md))
2. `server` sample documentation (see [here](sample/server/README.md))
3. `client` sample documentation (see [here](sample/client/README.md));
4. See the historical decisions [here](HISTORY.md)

## How to test it locally?

### 1. Build the `inspector` tool

```shell
cd inspector
make
```

### 2. Starting the server sample

Open a terminal and execute

```shell
cd sample/server
yarn install
yarn dev
```

After this command the server should be listening the `5555` port.

### 3. Starting the client sample

Open another terminal and execute

```shell
cd sample/client
yarn install
HTTPS=true yarn start
```

The client should be UP in the port `3000` or other (if anyone is already listening to this port).

**NOTE:** you should UP the server first because we are using a proxy in the client to do the requests to the server (see `proxy` config in [package.json](sample/client/package.json) file)

### 4. Creating a meeting

1. Open a browser at client page (usually https://127.0.0.1:3000/);
2. Create a new room with a cute name;
3. Add your name and confirm;
4. Congratulation! You are in a very SIMPLE meeting.


### 5. Start to inspecting

Inside a meeting you can start your webcam streaming. When you do it, the SFU will receive your RTP packets and send them to the `inspector` tool.

You probably will note that a folder called `inspector-results` will be created in the project root folder. 
Inside this folder you will see one file per video streaming using VP8.

The name of file should be the `<SSRC>.log`.

**IMPORTANT:** the `ssrc` used in the rtp consumed is different from the produced in the browser because mediasoup does it.

### 6. Check the RESULTS!

The output format is specified [here](inspector/README.md#output-format).

## Next steps

The `inspector` is a tool under development so there are too many things to do, such as:

* Add a few more automated tests;
* Improve EOS treatment;
* Detect corrupted frames comparing the frame size with the partitions size;
* Improve performance (we can reuse FrameInfo for more than one frame, it'll avoid many `calloc`/`free` calls);
* Extract more info about the frame;
* Evaluate how `packet loss` could affect the frame itself
  * Probably we need to look `rtpvp8depay` code more deeper to better undestanding
* Add RTSP support for realtime capture;
* Add a filter options to capture only specific scenarios (ex.: corrupted frames, unsupported bitstream, etc);
* Replace the current `vp8_parser` code to libvpx or similar (intel libva maybe?);
* Add support for others video codecs like H264, VP9 and AV1;
* Add support for IVF files (https://wiki.multimedia.cx/index.php/IVF);
* Add `--stdin` flag to read the input data directly from stdin;
* Transform that `server/src/mediaserver/inspector.ts` in one node module to simplify the integration with other solutions;
