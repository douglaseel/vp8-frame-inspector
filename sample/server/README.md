# A Very Simple SFU Service

This folder contains a very simple SFU service written in TypeScript.

It uses:
  * `express` for the HTTP routes;
  * `mediasoup` for the streaming part;
  * `socket.io` for the realtime signaling;


More info about this service:
- we are creating `N` workers, where `N` is the number of cpu cores that the instance has;
- we are using one router per meeting, without no optimizations (so it's a very limited meeting);
- we are only creating and closing the producers/consumers, without no logic for pause/resume;
- the produce and consume actions should ALWAYS start by the client side, so basically
  - a peer create a producer;
  - the other peers in the same room will be notified about it;
  - each peer can decide if will consume that stream or not;
  - This is A VERY SIMPLE MECHANISM :)

### `inspector` integration

As the `inspector` tool already demux multiple streams, we decided to create one instance per room, so basically:
- we spawn a `inspector` child process per room using `--port` and `--outputPath` options;
- we use a `PlainTransport` to send data to `inspector`;
- we create a `inspector` consumer for each new video producer in the room;

You can see more details in:
* [Inspector](src/mediaserver/inspector.ts) class: where we spawn the child process and create the `PlainTransport`;
* [Room](src/mediaserver/room.ts) class: where the `Inspector` instance is created;
* [WebRTCPeer](src/mediaserver/webrtc-peer.ts) class: where we create the `Inspector` consumer calling the `createConsumer()` method.


## Requisites

* node >= v16.6.0
* yarn >= v1.22.0

## Development

#### Install requisites

```shell
yarn install
```

#### How to run

```shell
yarn dev
```