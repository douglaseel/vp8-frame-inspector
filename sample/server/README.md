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
- we have one `inspector` instance per room (see [Room](src/mediaserver/room.ts) class)
- we are using a `PlainTransport` to send data to `inspector` (see [Inspector](src/mediaserver/inspector.ts) class)
- we are consuming every video producer in the room. Basically when one video producer is created, we also create a `inspector` consumer; 


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