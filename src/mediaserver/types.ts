import { types as mediasoupTypes } from 'mediasoup';
import { Socket } from 'socket.io';

export interface EnhancedSocket extends Socket {
  emitAsync: (event: string, ...data: any) => Promise<any>,
}

export type Track = {
  kind: mediasoupTypes.MediaKind,
  trackId: string, 
  paused?: boolean,
  customData?: any
}

export type Event = { 
  event: string,
  data: any[],
}

export type TransportConnectOptions = {
  dtlsParameters: mediasoupTypes.DtlsParameters
}

export type ProducerData = {
  kind: mediasoupTypes.MediaKind, 
  rtpParameters: mediasoupTypes.RtpParameters, 
  appData: any
}

export type ConsumerData = {
  id: string,
  producer: mediasoupTypes.Producer,
  rtpCapabilities: mediasoupTypes.RtpCapabilities;
  paused: boolean,
}

export type UserData = {
  id: string,
  userData: any,
  availableTracks: Track[]
}

export type RoomData = {
  appData: any,
  usersData: UserData[]
}

export type UserInitializeData = {
  appData: any,
  routerRtpCapabilities: mediasoupTypes.RtpCapabilities,
  usersData: UserData[]
}