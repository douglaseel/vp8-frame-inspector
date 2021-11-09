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

