# My historical decisions

This file describe the decisions taken to buid this project considering the timeline.

## How do we get the VP8 frames?

Since the begining of this project, I decided to build a solution very closed to the real scenarios, so try to get VP8 frames directly from Chromium or disabling SRTP was out of the question.

Therefore I decided to get those VP8 frames from a RTP stream provided by some SFU server. 


## VP8 bitstream, frame number and presentation timestamp (PTS)

I was never so deep into VP8 codec, so the first thing that I did was study the codec bitstream (https://datatracker.ietf.org/doc/html/rfc6386).

The first and obviously conclusion that I had was: 
  - I can't get the frame number and the presentation time looking to the VP8 bitstream, so I needed to get those info from my RTP receiver.


Considering that RTP seqnum and timestamp starts with random values and 1 frame propably will be splitted in more than 1 RTP packet, I did some considerations:
  - The frame "0" will be the first frame received by the `inspector`;
  - The presentation timestamp will be relative to the first frame received, so, every analyzed stream will have the presentation timestamp equals to zero for the first receiver frame;


## Extracting info from VP8 frame

In the begining I tried to do a very simple and high level tool, using `node`. 
I builded the GStreamer pipeline using `node-gtk` module and everything worked, until try to access the VP8 Frame buffer. 
The problem was something like: `I had the memory address from that buffer but how can I transform this into a node Buffer?`

So I decided to go back to my roots and replaced all `inspector` javascript code to C. This decision has some benefits:
  - No GStreamer wrapper needed;
  - Easily access to GStreamer VP8 frame data;
  - More easier to lead with bistreams too;


With the VP8 frame buffer in hands, the next step should be the most dangerous: parse the headers.

I try to look and undestand how I could use libvpx or similar to parse the VP8 headers, but with no success (I should try again!).

So I basically got the reference code (https://datatracker.ietf.org/doc/html/rfc6386), removed some things and used it only to get what I really nedeed.

Some info are pretty simple to check, like keyframe, show or not, resolution. 

However the golden and intref frames refresh are in the middle of the header that don't has a fixed size, so it's a little more complex.

So, to have 100% about our parser results we should add some automated tests in future.


## Output format

