import childProcess from 'child_process';
import { EventEmitter } from 'events';
import { types as mediasoupTypes } from 'mediasoup';
// @ts-ignore
import pickPort from 'pick-port';
import Settings from '../settings';

const PROCESS_KILL_TIMEOUT = 30000;

export type InspectorFailureReasons = 
  | 'parse-args'
  | 'invalid-args'
  | 'pipeline-link'
  | 'unknown';
  

export class Inspector extends EventEmitter {
  private readonly router: mediasoupTypes.Router;
  private readonly internalObserver: EventEmitter = new EventEmitter();

  private port?: number;
  private transport?: mediasoupTypes.PlainRtpTransport; 
  private consumers: Map<string, mediasoupTypes.Consumer> = new Map();

  private process: childProcess.ChildProcessWithoutNullStreams | undefined;
  private ready: boolean = false;
  private closed: boolean = false;

  constructor(
    router: mediasoupTypes.Router
  ) {
    super();

    this.router = router;
  }

  async load(): Promise<void> {
    // Allocate RTP port.
    const minPort = Settings.getInspectorMinPort()
    const maxPort = Settings.getInspectorMaxPort();
    this.port = await pickPort({ type: 'udp', minPort, maxPort });
    
    console.log('load()');
    if (this.ready) {
      throw new Error('load() | inspector was already loaded');
    }

    const command = `../inspector/out/inspector`;
    const args = [
      '--port', this.port!.toString(),
      '--payloadType', Settings.getVP8PayloadType().toString(),
      '--outputPath', Settings.getInspectorOutputPath(),
    ];

    this.transport = await this.router.createPlainTransport({
      listenIp: { ip: '0.0.0.0', announcedIp: undefined },
      comedia: false,
    });

    await this.transport.connect({
      ip: '127.0.0.1',
      port: this.port
    });

    return new Promise((resolve, reject) => {
      this.process = childProcess.spawn(command, args);

      this.handleProcess();
      this.internalObserver.once('@ready', () => resolve());
      this.internalObserver.once('@failure', reason => {
        reject(new Error(reason));
      });
    });
  }

  async close(): Promise<void> {
    console.log(`close()`);
    if (this.closed) {
      return;
    }

    this.closed = true;
    return new Promise<void>(resolve => {
      if (!this.process || this.process!.exitCode !== null) {
        resolve();
      } else {
        const killTimer = setTimeout((): void => {
          try {
            this.process!.kill('SIGKILL');
          } catch (error) {}
        }, PROCESS_KILL_TIMEOUT);

        this.process!.once('close', () => {
          clearTimeout(killTimer);
          resolve();
        });

        this.process!.kill('SIGINT');
      }
    });
  }

  async createConsumer (producer: mediasoupTypes.Producer) : Promise<void> {
    const rtpCapabilities: mediasoupTypes.RtpCapabilities = {
      codecs: Settings.getRouterOptions().mediaCodecs!.filter(codec => codec.mimeType === 'video/VP8'),
    };

    const consumer = await this.transport!.consume({
      producerId: producer.id,
      rtpCapabilities: rtpCapabilities,
      paused: true,
    });

    producer.observer.on('close', () => {
      consumer.close();
      this.consumers.delete(producer.id);
    })

    this.consumers.set(producer.id, consumer);
    await consumer.resume();
  }

  private handleProcess(): void {
    this.process!.stderr?.setEncoding('utf-8');
    this.process!.stdout?.setEncoding('utf-8');

    this.process!.on('message', message => {
      console.log(`process 'message' event [message:${message}]`);
    });

    this.process!.on('error', error => {
      console.error(`process 'error' event [error:${error}]`);
    });

    this.process!.once('close', (code: number) => {
      console.log(`process 'close' event`);

      this.close();

      if (code > 0) {
        let reason: InspectorFailureReasons = 'unknown';
        if (code === 1) {
          reason = 'parse-args';
        } else if (code === 2) {
          reason = 'invalid-args';
        } else if (code === 3) {
          reason = 'pipeline-link';
        }
        console.error(`process 'close' event [reason:${reason}]`);
        if (!this.ready) {
          this.internalObserver.emit('@failure', reason);
        } else {
          this.emit('error', reason);
        }
      }
    });

    this.process!.stderr.on('data', data => {
      console.log(data.slice(0, -1));
    });

    this.process!.stdout.on('data', (data: string) => {
      this.onMessage(data);
    });
  }

  private onMessage(message: string): void {
    console.log(`onMessage() [message: ${message}]`);

    // We ignore the last element for message.
    message
      .split('\n')
      .slice(0, -1)
      .forEach(msg => {
        try {
          const { event, data } = JSON.parse(msg);
          switch (event) {
            case 'ready':
              return this.onReady();
            default:
              console.log(`onMessage() | unknown event [event: ${event}]`);
          }
        } catch (error: any) {
          console.error(`onMessage() | [error:${error}]`);
        }
      });
  }

  private onReady(): void {
    console.log('onReady()');
    this.ready = true;
    this.internalObserver.emit('@ready');
  }
}
