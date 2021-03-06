import { EventEmitter } from "events";
import { types as mediasoupTypes } from 'mediasoup';
import { Socket } from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import { WebRTCPeer } from "./webrtc-peer";
import { Inspector } from "./inspector";
import { 
  RoomData, 
  UserData, 
} from '../types';

const MAX_IDLE_TIME = 600000

export class Room extends EventEmitter {
  private readonly id: string;
  private readonly router: mediasoupTypes.Router;
  private readonly inspector: Inspector;
  private readonly transportOptions: mediasoupTypes.WebRtcTransportOptions;
  private readonly peers: Map<string, WebRTCPeer> = new Map();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private closed: boolean = false;

  readonly appData: object;

  constructor (id: string, appData: object, router: mediasoupTypes.Router, transportOptions: mediasoupTypes.WebRtcTransportOptions) {
    super();

    this.id = id;
    this.appData = appData;
    this.router = router;
    this.transportOptions = transportOptions;
    this.inspector = new Inspector(router);
  }

  async load () : Promise<void> {
    this.inspector.load();
  }

  close () : void {
    if (this.closed) {
      return;
    }
    
    this.closed = true;
    console.log(`close() [roomId:${this.id}]`);
    this.clearIdleTimer();
    this.peers.forEach(peer => {
      peer.closeConnection();
    });
    this.peers.clear();
    this.router.close();
    this.inspector.close();
  }

  private getInfo () : RoomData {
    const usersData: UserData[] = [];
    this.peers.forEach(peer => {
      if (peer.isReady()) {
        usersData.push({ 
          id: peer.id, 
          userData: peer.getUserData() ,
          availableTracks: peer.getAvailableTracks()
        });
      }
    })
    return { appData: this.appData, usersData };
  }

  async addPeer (socket: Socket) : Promise<void> {
    const id = uuidv4();
    const peer = new WebRTCPeer(id, socket, this.router, this.transportOptions, this.inspector);

    peer.on('disconnect', () => this.onPeerDisconnect(id));
    peer.on('ready', () => this.onPeerReady(id));
    peer.on('newProducer', ({ producer }) => this.onPeerNewProducer(id, producer));
    peer.on('message', (message, fn) => this.onPeerMessage({ id, message }, fn ));
    peer.on('consumeTrack', ({ peerId, trackId, paused }, fn) => this.onConsumeTrack({ id, peerId, trackId, paused }, fn));
  
    const roomInfo = this.getInfo();

    this.peers.set(id, peer);
    this.clearIdleTimer();

    await peer.load({
      ...roomInfo,
      routerRtpCapabilities: this.router.rtpCapabilities
    });
  }

  private onPeerDisconnect (id: string) : void {
    console.log(`onPeerDisconnect() [id:${id}]`);
    this.peers.delete(id);
    this.broadcastMessage('peerDisconnection', { id }, id);
    if (!this.peers.size) {
      this.restartIdleTimer();
    }
  }

  private onPeerReady (id: string) : void {
    const peer = this.peers.get(id);
    const userData = peer!.getUserData();
    this.broadcastMessage('peerConnection', { id, userData }, id);
  }

  private onPeerNewProducer (id: string, producer: mediasoupTypes.Producer) : void {
    console.log(`onPeerNewProducer() [id:${id}, trackId:${producer.id}]`);
    const trackId = producer.id;
    const availableTrack = { id, trackId, kind: producer.kind, customData: producer.appData };
    this.broadcastMessage('newTrackAvailable', availableTrack, id);
  }

  private onPeerMessage (
    { id, message } : { id: string, message: any }, 
    fn : Function
  ) : void {
    this.broadcastMessage('peerMessage', { id, message }, id)
    fn(null)
  }

  private async onConsumeTrack (
    { id, peerId, trackId, paused } : { id: string, peerId: string, trackId: string, paused?: boolean }, 
    fn: Function
  ) : Promise<void> {
    try {
      const remotePeer = this.peers.get(peerId);
      if (!remotePeer) {
        throw new Error(`Peer ${peerId} does not exist`);
      }
      const producer = remotePeer.getProducer({ trackId });
      if (!producer) {
        throw new Error(`Peer ${peerId} does not have track ${trackId}`);
      }
      const peer = this.peers.get(id);
      const rtpCapabilities = remotePeer.getRtpCapabilities();
      await peer!.createConsumer({
        id: remotePeer.id,
        producer,
        rtpCapabilities,
        paused: paused || producer.paused,
      });
      fn(null);
    } catch (error) {
      console.error(error);
      fn(error);
    }
  }

  private broadcastMessage (event: string, message: any, exceptId?: string) {
    this.peers.forEach( peer => {
      if (peer.id !== exceptId) {
        peer.emitMessage(event, message);
      }
    })
    this.emit(event, message);
  }

  private clearIdleTimer () {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private restartIdleTimer () {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      console.log(`restartIdleTimer() | timeout [roomId:${this.id}]`);
      this.emit('maxIdleTimeExceeded');
    }, MAX_IDLE_TIME);
  }
}