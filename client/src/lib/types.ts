import { types as mediasoupTypes } from 'mediasoup';

export type Track = {
  kind: mediasoupTypes.MediaKind,
  trackId: string, 
  paused?: boolean,
  customData?: any
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
  producerId: string,
  consumerId: string,
  kind: mediasoupTypes.MediaKind,
  rtpParameters: mediasoupTypes.RtpParameters,
  appData: any,
  paused?: boolean,
  id: string,
}

export type UserData = {
  id: string,
  userData: any,
  availableTracks: Track[]
}

export type InitializeData = {
  id: string, 
  routerRtpCapabilities: mediasoupTypes.RtpCapabilities, 
  appData: any,
  usersData: UserData[]
}
