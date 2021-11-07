// @ts-ignore
/*import gi from 'node-gtk';

const GST_PAD_PROBE_TYPE_BUFFER = (1 << 4);

const Gst = gi.require('Gst', '1.0');

gi.startLoop();
// Initialize GStreamer
Gst.init()

const pipeline = new Gst.Pipeline();

const udpsrc = Gst.ElementFactory.make('udpsrc');
udpsrc.port = 8888;

const rtpCaps = Gst.Caps.newEmptySimple('application/x-rtp');
udpsrc.caps = rtpCaps;

const depay = Gst.ElementFactory.make('rtpvp8depay');
const pad = depay.getStaticPad("src");

const bufferProbe = (pad: any, probe: any, data: any) : number => {
  const buffer = probe.getBuffer();
  if (!buffer.hasFlags(Gst.BufferFlags.DELTA_UNIT)) {
    console.log('New keyframe', buffer.pts / 1000000); 

    const [ res, mapInfo ] = buffer.map(Gst.MapFlags.READ);
    if (res) {
      console.log("MAP INFO", mapInfo.size);
      const buf = Buffer.from(mapInfo.data, 0, mapInfo.size);
      console.log(buf);
    }
  }
  //console.log('Delta Frame?', buffer.hasFlags(Gst.BufferFlags.DELTA_UNIT));
  //console.log('GstClockTime', buffer.dts / 1000000, buffer.pts / 1000000);
  return Gst.PadProbeReturn.OK;
}   

pad.addProbe(Gst.PadProbeType.BUFFER, bufferProbe);

const sink = Gst.ElementFactory.make('appsink');
sink.setProperty('emit-signals', true);
sink.on('new-sample', () => {
  const sample = sink.emit('pull-sample');
  if (sample) {
    return Gst.FlowReturn.OK
  }
  return Gst.FlowReturn.ERROR
})

pipeline.add(udpsrc);
pipeline.add(depay);
pipeline.add(sink);

udpsrc.link(depay);
depay.link(sink);




pipeline.setState(Gst.State.PLAYING)


setTimeout(() => {
  pipeline.setState(Gst.State.NULL);


}, 10000)
*/

// @ts-ignore
import Gst from 'gstreamer-superficial';
import { VP8FrameBuffer } from './vp8';


const port = 8888
const pipeline = new Gst.Pipeline(`udpsrc name=udpsrc port=${port} ! rtpvp8depay ! appsink name=sink`);

const udpsrc = pipeline.findChild('udpsrc');
udpsrc.caps = 'application/x-rtp';

const sink = pipeline.findChild('sink');

const onData = (buffer: Buffer) : void => {
  console.log("onData", buffer);
  if (buffer) {
    const frameBuffer = new VP8FrameBuffer(buffer);
    console.log(frameBuffer.dump());
  }
}

sink.pull(onData);

pipeline.play();
