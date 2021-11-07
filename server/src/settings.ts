import { types as mediasoupTypes } from 'mediasoup';

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
        }, {
          kind       : 'video',
          mimeType   : 'video/VP8',
          clockRate  : 90000,
        }
      ]
    };
  }

  static getAnnouncedIps () : string[] | undefined {
    return;
  }
}