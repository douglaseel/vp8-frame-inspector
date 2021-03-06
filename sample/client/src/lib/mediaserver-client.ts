import io, { Socket } from 'socket.io-client';
import { Device, types as mediasoupTypes } from 'mediasoup-client';
import { EventEmitter } from 'eventemitter3';
import { ConsumerData, ProducerData, InitializeData } from './types';

export class MediaServerClient extends EventEmitter {
  private readonly url: string;
  private readonly roomId: string;
  private readonly userData: any;
  
  private socket?: Socket;
  private device?: mediasoupTypes.Device;
  private recvTransport?: mediasoupTypes.Transport;
  private sendTransport?: mediasoupTypes.Transport;

  private producers: Map<string, mediasoupTypes.Producer> = new Map();
  private consumers: Map<string, mediasoupTypes.Consumer> = new Map();

  private connected: boolean = false;
  private ready: boolean = false;

  constructor (url: string, roomId: string, userData: any) {
    super()

    this.url = url;
    this.roomId = roomId;
    this.userData = userData;
    this.initializeSocket();
  }

  initializeSocket () : void {
    const url = new URL(this.url);
    this.socket = io(url.origin, { 
      path: `/api/v1/ws`, 
      query: {
        roomId: this.roomId
      },
      reconnection: false
    });

    // eventos de conexão
    this.socket.on('connect', () => this.onConnect());
    this.socket.on('disconnect', async () => this.onDisconnect());

    // eventos de setup
    this.socket.on('initialize', async (data, fn) => await this.onInitialize(data, fn));

    // eventos do consumer
    this.socket.on('newConsumer', async (data, fn) => await this.onNewConsumer(data, fn));
    this.socket.on('consumerClosed', (data) => this.onConsumerClosed(data));

    // eventos da sala
    this.socket.on('peerConnection', ({ id, userData }) => this.onPeerConnection(id, userData));
    this.socket.on('peerDisconnection', ({ id }) => this.onPeerDisconnection(id));
    this.socket.on('peerMessage', ({ id, message }) => this.onPeerMessage(id, message));

    this.socket.on('newTrackAvailable', ({ id, trackId, kind }) => this.onNewTrackAvailable(id, trackId, kind));
  }

  disconnect () {
    this.socket!.close()
  }

  async addTrack(track: MediaStreamTrack) : Promise<string> {
    const producer = await this.sendTransport!.produce({ track })
    this.producers.set(producer.id, producer)
    return producer.id
  }

  finalizeTrack (trackId: string) : void {
    const producer = this.producers.get(trackId);
    if (!producer) {
      throw new Error(`Track com id ${trackId} não existe`);
    }
    producer.close();
    this.socket!.emit('producerClosed', { id: trackId });
    this.producers.delete(trackId);
  }

  async addMicrophoneTrack () : Promise<string> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const track = stream.getAudioTracks()[0];
    const trackId = await this.addTrack(track);
    return trackId;
  }

  async addCameraTrack () : Promise<string> {   
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const track = stream.getVideoTracks()[0];
    const trackId = await this.addTrack(track);
    return trackId;
  }

  async resumeTrack (trackId: string) : Promise<void> {
    const producer = this.producers.get(trackId);
    if (!producer) {
      throw new Error(`Track com id ${trackId} não existe`);
    }
    if (!producer.paused) {
      throw new Error(`Track com id ${trackId} já está sendo transmitida`);
    }
    await producer.resume();
    await this.emitAsync('resumeProducer', { id: trackId });
  }

  async pauseTrack (trackId: string) : Promise<void> {
    const producer = this.producers.get(trackId);
    if (!producer) {
      throw new Error(`Track com id ${trackId} não existe`);
    }
    if (producer.paused) {
      throw new Error(`Track com id ${trackId} já está pausada`);
    }
    await producer.pause();
    await this.emitAsync('pauseProducer', { id: trackId });
  }

  stopTrack (trackId: string) : void {
    const producer = this.producers.get(trackId);
    if (!producer) {
      throw new Error(`Track ${trackId} doesn't exist`);
    }
    producer.close();
    this.producers.delete(trackId);
    this.socket!.emit('producerClosed', { id: trackId });
  }

  async startConsumingTrack (id: string, trackId: string) : Promise<MediaStreamTrack> {
    console.log(`[startConsumingTrack] requesting for a track ${trackId} consumer`);
    let consumer = this.consumers.get(trackId);
    if (consumer) {
      await this.emitAsync('resumeConsumer', { id, trackId });
      await consumer.resume();
    } else {
      await this.emitAsync('createConsumer', { id, trackId });
      consumer = this.consumers.get(trackId);
    }
    return consumer!.track;
  }

  async stopConsumingTrack (trackId: string) : Promise<void> {
    const consumer = this.consumers.get(trackId);
    if (!consumer) {
      throw new Error(`Track ${trackId} consumer doesn't exist!`);
    }
    await this.emitAsync('pauseConsumer', { trackId });
    await consumer.pause();
  }

  private onConnect () : void {
    this.connected = true;
    this.emit('connected');
  }

  private onDisconnect () : void {
    this.connected = false;
    this.ready = false;

    this.recvTransport?.close();
    this.sendTransport?.close();
    this.emit('disconnected');
  }

  private onPeerConnection (id: string, userData: any) : void {
    this.emit('userJoined', id, userData);
  }

  private onPeerDisconnection (id: string) : void {
    this.emit('userLeft', id);
  }

  private onPeerMessage (id: string, message: any) : void {
    this.emit('message', id, message);
  }

  private onNewTrackAvailable (id: string, trackId: string, kind: mediasoupTypes.MediaKind) : void {
    if (kind === 'audio') {
      this.emit('newAudioTrackAvailable', id, trackId);
    } else {
      this.emit('newVideoTrackAvailable', id, trackId);
    }
  }

  private async onInitialize (
    { id, routerRtpCapabilities, appData, usersData } : InitializeData, 
    fn: Function
  ) : Promise<void> {
    try {
      console.log('[onInitialize] Initializing peer');
      this.device = new Device();
      await this.device.load({ routerRtpCapabilities });
      await this.createTransports();
      fn(null, { rtpCapabilities: this.device.rtpCapabilities, userData: this.userData });
      
      this.ready = true;
      this.emit('ready', id, appData, usersData);
    } catch (error) {
      console.error(error);
      fn(error);
    }
  }

  private async createTransports () : Promise<void> {
    console.log('[createTransports] Creating recv transport!');
    await this.createRecvTransport();
    console.log('[createTransports] Creating send transport!');
    await this.createSendTransport();
    console.log('[createTransports] All transports were created with success!');
  }

  private async createRecvTransport () : Promise<void> {
    const transportInfo = await this.emitAsync('createRecvTransport');
    this.recvTransport = await this.device!.createRecvTransport(transportInfo);
    this.recvTransport.on('connect', async (
      { dtlsParameters } : { dtlsParameters: mediasoupTypes.DtlsParameters },
      callback: Function,
      errback: Function
    ) => {
      await this.onRecvTransportConnect({ dtlsParameters }, callback, errback );
    });
  }

  private async onRecvTransportConnect (
    { dtlsParameters } : { dtlsParameters: mediasoupTypes.DtlsParameters }, 
    callback: Function, 
    errback: Function
  ) : Promise<void> {
    try {
      console.log('[onRecvTransportConnect] Connecting recv transport!');
      await this.emitAsync('connectRecvTransport', { transportId: this.recvTransport!.id, dtlsParameters });
      callback();
    } catch (error) {
      errback(error);
    }
  }

  private async createSendTransport () {
    const transportInfo = await this.emitAsync('createSendTransport');
    this.sendTransport = await this.device!.createSendTransport(transportInfo);

    this.sendTransport.on('connect', async (
      { dtlsParameters } : { dtlsParameters: mediasoupTypes.DtlsParameters }, 
      callback: Function, 
      errback: Function
    ) => {
      await this.onSendTransportConnect({ dtlsParameters }, callback, errback);
    })

    this.sendTransport.on('produce', async (
      producerData: ProducerData,
      callback: Function,
      errback: Function
    ) => { 
      await this.onNewProducer(producerData, callback, errback); 
    });
  }

  private async onSendTransportConnect (
    { dtlsParameters } : { dtlsParameters: mediasoupTypes.DtlsParameters }, 
    callback: Function, 
    errback: Function
  ) : Promise<void> {
    try {
      console.log('[createSendTransport] Connecting send transport!');
      await this.emitAsync('connectSendTransport', { transportId: this.sendTransport!.id, dtlsParameters })
      callback();
    } catch (error) {
      errback(error);
    }
  }

  private async onNewProducer (producerData: ProducerData, callback: Function, errback: Function) {
    try {
      console.log('[onNewProducer]', producerData)
      const { id } = await this.emitAsync('newProducer', {
        transportId   : this.sendTransport!.id,
        kind          : producerData.kind,
        rtpParameters : producerData.rtpParameters,
        appData       : producerData.appData
      })
      callback({ id })
    } catch (exception) {
      errback(exception)
    }
  }
  
  private async onNewConsumer (data: ConsumerData, fn: Function) : Promise<void> {
    try {
      console.log('[onNewConsumer]', data);
      const consumer = await this.recvTransport!.consume({
        id            : data.consumerId,
        producerId    : data.producerId,
        kind          : data.kind,
        rtpParameters : data.rtpParameters,
        appData       : data.appData
      });

      this.consumers.set(data.producerId, consumer);
      fn(null);
    } catch (error) {
      console.error(error);
      fn(error);
    }
  }

  private onConsumerClosed (
    { id, trackId } : { id: string, trackId: string }
  ) : void {
    try {
      const consumer = this.consumers.get(trackId);
      if (consumer) {
        consumer.close();
        this.consumers.delete(trackId);
      }
      this.emit('trackEnded', id, trackId);
    } catch (error) {
      console.error(error);
    }
  }

  async sendMessage (message: any) {
    this.emitAsync('message', message);
  }
  
  private emitAsync(event: string, body?: any) : Promise<any> {
    return new Promise((resolve, reject) => {
      this.socket!.emit(event, body, (err: any, data: any) => {
        if (!err) {
          resolve(data);
        } else {
          reject(err);
        }
      });
    });
  }
};