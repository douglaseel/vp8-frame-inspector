
import { EventEmitter } from "events";
import { types as mediasoupTypes } from 'mediasoup';
import { Socket } from "socket.io";
import { promisify } from "util";
import { 
  Track,
  Event,
  ConsumerData,
  ProducerData,
  TransportConnectOptions,
  UserInitializeData,
} from './types';

export class WebRTCPeer extends EventEmitter {
  readonly id: string;

  private readonly socket: Socket;
  private readonly router: mediasoupTypes.Router;
  private readonly transportOptions: mediasoupTypes.WebRtcTransportOptions;
  private readonly consumers: Map<string, mediasoupTypes.Consumer> = new Map();
  private readonly producers: Map<string, mediasoupTypes.Producer> = new Map();
  private readonly emitAsync: (event: string, ...data: any) => Promise<any>;
  private recvTransport?: mediasoupTypes.WebRtcTransport;
  private sendTransport?: mediasoupTypes.WebRtcTransport;
  private rtpCapabilities?: mediasoupTypes.RtpCapabilities;

  private ready: boolean = false;
  private eventsPool: Event[] = [];
  private userData: any;


  constructor (
    id: string,
    socket: Socket,
    router: mediasoupTypes.Router,
    transportOptions: mediasoupTypes.WebRtcTransportOptions
  ) {
    super()

    this.id = id;
    this.socket = socket;
    this.router = router;
    this.transportOptions = transportOptions;
    this.emitAsync = promisify(this.socket.emit);
    this.handleSocket()
  }

  private handleSocket () : void {
    // connection events
    this.socket.on('disconnect', () => this.onDisconnect());

    // transport events
    this.socket.on('createRecvTransport',  async (fn: Function) => await this.onCreateRecvTransport(fn));
    this.socket.on('connectRecvTransport', async (
      connectOptions: TransportConnectOptions, 
      fn: Function
    ) => {
      await this.onConnectRecvTransport(connectOptions, fn);
    });
    
    this.socket.on('createSendTransport',  async (fn: Function) => await this.onCreateSendTransport(fn));
    this.socket.on('connectSendTransport', async (
      connectOptions: TransportConnectOptions, 
      fn: Function
    ) => {
      await this.onConnectSendTransport(connectOptions, fn);
    });

    // producer events
    this.socket.on('newProducer', async (
      producerData: ProducerData, 
      fn: Function
    ) => {
      await this.onNewProducer(producerData, fn);
    });

    this.socket.on('producerClosed', ({ id } : { id: string }) => this.onProducerClosed(id));
    this.socket.on('resumeProducer', async (
      { id } : { id: string }, 
      fn: Function
    ) => {
      await this.onResumeProducer(id, fn)
    });
    
    this.socket.on('pauseProducer', async (
      { id } : { id: string }, 
      fn: Function
    ) => { 
      await this.onPauseProducer(id, fn)
    });

    // consumer events
    this.socket.on('createConsumer', async (
      { id, trackId } : { id: string, trackId: string },
      fn: Function
    ) => {
      await this.onCreateConsumer({ id, trackId}, fn);
    });

    this.socket.on('pauseConsumer', async (
      { trackId } : { trackId: string },
      fn: Function
    ) => {
      await this.onPauseConsumer(trackId, fn);
    });

    this.socket.on('resumeConsumer', async (
      { trackId } : { trackId: string },
      fn: Function
    ) => {
      await this.onResumeConsumer(trackId, fn);
    });

    this.socket.on('closeConsumer', async (
      { trackId } : { trackId: string },
      fn: Function
    ) => { 
      await this.onCloseConsumer(trackId, fn); 
    });

    // other events
    this.socket.on('message', (message: any, fn: Function) => this.onMessage(message, fn));
  }

  async load (
    { appData, routerRtpCapabilities, usersData } : UserInitializeData
  ) : Promise<void> {
    try {      
      const { rtpCapabilities, userData } = await this.emitAsync('initialize', { id: this.id, appData, routerRtpCapabilities, usersData})
      this.rtpCapabilities = rtpCapabilities
      this.userData = userData
      this.ready = true
      this.emit('ready')

      console.log(`[initialize] ${this.id} => Inicializou e está pronto. Emitindo ${this.eventsPool.length} eventos acumulados`)
      this.eventsPool.forEach(({ event, data }) => this.emitMessage(event, ...data))
      this.eventsPool = []
    } catch (error) {
      console.error(error)
    }
  }

  closeConnection () {
    this.socket.disconnect(true);
  }

  getRtpCapabilities () : mediasoupTypes.RtpCapabilities {
    if (!this.ready) {
      throw new Error(`Peer ${this.id} is not ready yet!`);
    }
    return this.rtpCapabilities!;
  }

  private onDisconnect () : void {
    this.ready = false;
    this.sendTransport?.close();
    this.recvTransport?.close();
    console.log(`[onDisconnect] ${this.id} => Desconectou!`);
    this.emit('disconnect');
  }

  private async onCreateRecvTransport (fn: Function) : Promise<void> {
    try {
      console.log(`[onCreateRecvTransport] ${this.id} => Criando camada de transporte`)
      this.recvTransport = await this.router.createWebRtcTransport(this.transportOptions)
      console.log(`[onCreateRecvTransport] ${this.id} => Criou a camada de transporte`)
      
      this.recvTransport.observer.on('close', () => {
        this.consumers.forEach(consumer => {
          consumer.close();
        })
        this.consumers.clear();
      })
      
      fn(null, {
        id             : this.recvTransport.id,
        iceParameters  : this.recvTransport.iceParameters,
        iceCandidates  : this.recvTransport.iceCandidates,
        dtlsParameters : this.recvTransport.dtlsParameters,
        sctpParameters : this.recvTransport.sctpParameters
      })
    } catch (error) {
      console.error(error)
      fn(error)
    }
  }

  private async onConnectRecvTransport (
    { dtlsParameters } : TransportConnectOptions, 
    fn: Function
  ) : Promise<void> {
    try {
      await this.recvTransport!.connect({ dtlsParameters })
      fn(null)
    } catch (error) {
      fn(error)
    }
  }

  private async onCreateSendTransport (fn: Function) : Promise<void> {
    try {
      console.log(`[onConnectSendTransport] ${this.id} => criando camada de transporte para transmissão`)
      this.sendTransport = await this.router.createWebRtcTransport(this.transportOptions)
      this.sendTransport.observer.on('close', async () => {
        this.producers.forEach(producer => {
          producer.close();
        })
        this.producers.clear();
      })

      fn(null, {
        id             : this.sendTransport.id,
        iceParameters  : this.sendTransport.iceParameters,
        iceCandidates  : this.sendTransport.iceCandidates,
        dtlsParameters : this.sendTransport.dtlsParameters,
        sctpParameters : this.sendTransport.sctpParameters
      })
    } catch (error) {
      fn(error)
    }
  }

  private async onConnectSendTransport (
    { dtlsParameters } : { dtlsParameters: mediasoupTypes.DtlsParameters }, 
    fn: Function
  ) : Promise<void> {
    try {
      console.log(`[onConnectSendTransport] ${this.id} => conectando camada de transporte`)
      await this.sendTransport!.connect({ dtlsParameters })
      fn(null)
    } catch (error) {
      fn(error)
    }
  }

  private async onNewProducer (
    { kind, rtpParameters, appData } : ProducerData, 
    fn : Function
  ) {
    try {
      console.log(`[onNewProducer] ${this.id} => criando novo producer`)
      const producer = await this.sendTransport!.produce({ kind, rtpParameters, paused: true, appData })
      fn(null, { id: producer.id })

      this.producers.set(producer.id, producer)
      
      this.emit('newProducer', { producer, rtpCapabilities: this.rtpCapabilities! })
      await producer.resume()
    } catch (error) {
      fn(error)
    }
  }

  private onProducerClosed (id: string) : void {
    const producer = this.producers.get(id)
    if (producer) {
      producer.close()
      this.producers.delete(id)
    }
  }

  private async onResumeProducer (id: string, fn: Function) : Promise<void> {
    try {
      const producer = this.producers.get(id)
      if (!producer) {
        throw new Error(`Producer com id ${id} não existe`)
      }
      await producer.resume()
      fn(null)
    } catch (error) {
      console.error(error)
      fn(error)
    }
  }

  private async onPauseProducer (id: string, fn: Function) : Promise<void> {
    try {
      const producer = this.producers.get(id);
      if (!producer) {
        throw new Error(`Producer com id ${id} não existe`);
      }
      await producer.pause();
      fn(null);
    } catch (error) {
      console.error(error);
      fn(error);
    }
  }

  private onCreateConsumer (
    { id, trackId } : { id: string, trackId: string }, 
    fn: Function
  ) : void {
    this.emit('consumeTrack', { peerId: id, trackId }, fn)
  }

  private async onPauseConsumer (trackId: string, fn: Function) : Promise<void> {
    try {
      const consumer = this.consumers.get(trackId);
      if (!consumer) {
        throw new Error(`Consumer da track com id ${trackId} não existe`);
      }
      await consumer.pause();
      fn(null);
    } catch (error) {
      console.error(error)
      fn(error)
    }
  }

  private async onResumeConsumer (trackId: string, fn: Function) : Promise<void> {
    try {
      const consumer = this.consumers.get(trackId);
      if (!consumer) {
        throw new Error(`Consumer da track com id ${trackId} não existe`);
      }
      await consumer.resume();
      fn(null);
    } catch (error) {
      console.error(error);
      fn(error);
    }
  }

  private onCloseConsumer (trackId: string, fn: Function) : void {
    this.closeConsumer(trackId)
    fn(null)
  }

  async resumeConsumer (
    { trackId } : { trackId : string }
  ) : Promise<void> {
    const consumer = this.consumers.get(trackId);
    if (!consumer) {
      throw new Error(`Consumer da track com id ${trackId} não existe`);
    }
    await consumer.resume();
  }

  async pauseConsumer (
    { trackId } : { trackId : string }
  ) : Promise<void> {
    const consumer = this.consumers.get(trackId);
    if (!consumer) {
      throw new Error(`Consumer da track com id ${trackId} não existe`);
    }
    await consumer.pause();
  }

  closeConsumer (trackId : string) : void {
    this.consumers.get(trackId)?.close();
    this.consumers.delete(trackId);
  }

  async createConsumer (
    { id, producer, paused, rtpCapabilities } : ConsumerData 
  ) : Promise<void> {  
    console.log(`[createConsumer] ${this.id} => criando consumer do participante ${id}`);
    const consumer = await this.recvTransport!.consume({
      producerId: producer.id,
      appData: producer.appData,
      rtpCapabilities,
      paused: true,
    });

    producer.observer.on('close', () => {
      consumer.close();
      this.consumers.delete(producer.id);
      this.socket.emit('consumerClosed', { 
        id, 
        trackId: producer.id 
      });
    });

    this.consumers.set(producer.id, consumer);
    await this.emitAsync('newConsumer', {
      producerId: producer.id,
      consumerId: consumer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      appData: consumer.appData,
      paused,
      id
    });

    await consumer.resume();
  }

  onMessage (
    message: any,
    fn: Function
  ) : void {
    this.emit('message', message, fn);
  }
  
  emitMessage (
    event: string, 
    ...data: any
  ) : void {
    if (this.ready) {
      this.socket.emit(event, ...data);
    } else {
      console.log('[emitMessage] Peer ainda não está pronto. Armazenando evento', event, data);
      this.eventsPool.push({ event, data });
    }
  }

  getProducer (
    { trackId } : { trackId: string }
  ) : mediasoupTypes.Producer | undefined {
    return this.producers.get(trackId)
  }
  
  getConsumer (
    { trackId } : { trackId: string }
  ) : mediasoupTypes.Consumer | undefined {
    return this.consumers.get(trackId)
  }

  getUserData () : any {
    return this.userData;
  }

  getAvailableTracks () : Track[] {
    let availableTracks: Track[] = [];
    this.producers.forEach(producer => {
      const availableTrack = { 
        trackId: producer.id, 
        kind: producer.kind,
        paused: producer.paused,
        customData: producer.appData
      };
      availableTracks.push(availableTrack);
    })
    return availableTracks;
  }

  isReady () : boolean {
    return this.ready
  }
}