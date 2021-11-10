import { types as mediasoupTypes } from 'mediasoup-client';

export type Track = {
  kind: mediasoupTypes.MediaKind,
  trackId: string, 
  paused?: boolean,
}

export type TransportConnectOptions = {
  dtlsParameters: mediasoupTypes.DtlsParameters
}

export type ProducerData = {
  kind: mediasoupTypes.MediaKind, 
  rtpParameters: mediasoupTypes.RtpParameters, 
  appData: AppData
}

export type ConsumerData = {
  producerId: string,
  consumerId: string,
  kind: mediasoupTypes.MediaKind,
  rtpParameters: mediasoupTypes.RtpParameters,
  appData: AppData,
  paused?: boolean,
  id: string,
}

export type UserData = {
  id: string,
  userData: any,
  availableTracks: Track[]
}

export type AppData = {
  name: string
}

export type InitializeData = {
  id: string, 
  routerRtpCapabilities: mediasoupTypes.RtpCapabilities, 
  appData: AppData,
  usersData: UserData[]
}