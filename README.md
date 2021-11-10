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

This repo has a few docs, so we recommend you to read in this order:

1. `inspector` documentation (see [here](inspector/README.md))
2. `server` sample documentation (see [here](sample/server/README.md))
3. `client` sample documentation (see [here](sample/client/README.md));
4. `How to test it locally?` documentation (see [here](HOWTO.md))
5. See the historical decisions [here](HISTORY.md)
6. Look into the `inspector` code, there are a few comments to guide you there!