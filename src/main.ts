import { Buffer } from "buffer";
import { VP8FrameBuffer } from "./vp8";

// keyframe buffer
const test01 = Buffer.from([ 0x90, 0x18, 0x06, 0x9d, 0x01, 0x2a, 0x00, 0x05, 0xd0, 0x02 ])
const frameBuffer01 = new VP8FrameBuffer(test01);
console.log("test01 [keyframe]:", frameBuffer01.dump());

// interframe buffer
const test02 = Buffer.from([ 0xb1, 0x1b, 0x02 ])
const frameBuffer02 = new VP8FrameBuffer(test02);
console.log("test02 [interframe]:", frameBuffer02.dump());
