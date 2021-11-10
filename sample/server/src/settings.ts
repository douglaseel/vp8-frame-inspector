import { types as mediasoupTypes } from 'mediasoup';


const OPUS_PAYLOAD_TYPE = 100;
const VP8_PAYLOAD_TYPE = 101;

export class Settings {

  static getPort () : number {
    return 5555;
  }
  
  static getWorkerSettings () : mediasoupTypes.WorkerSettings {
    return {
      rtcMinPort: 40000,
      rtcMaxPort: 50000,
    };
  }

  static getRouterOptions () : mediasoupTypes.RouterOptions {
    return {
      mediaCodecs: [
        {
          kind      : 'audio',
          mimeType  : 'audio/opus',
          clockRate : 48000,
          channels  : 2,
          preferredPayloadType: OPUS_PAYLOAD_TYPE,
        }, {
          kind       : 'video',
          mimeType   : 'video/VP8',
          clockRate  : 90000,
          preferredPayloadType: VP8_PAYLOAD_TYPE, 
        }
      ]
    };
  }

  static getVP8PayloadType () : number {
    return VP8_PAYLOAD_TYPE;
  }

  static getAnnouncedIps () : string[] | undefined {
    return;
  }

  static getInspectorMinPort () : number {
    return 30000;
  }

  static getInspectorMaxPort () : number {
    return 35000;
  }

  static getInspectorOutputPath () : string {
    return '../../inspector-logs/';
  }
}

export default Settings;