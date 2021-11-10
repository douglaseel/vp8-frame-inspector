# A Very Simple React App

This folder contains a very simple React app to interact with the server sample.

No much to say about this part, but you can check the [mediaserver-client](src/lib/mediaserver-client.ts) file to better understanding about the signalling with the server part.

**IMPORTANT 1:** the server should be UP when you use this app;

**IMPORTANT 2:** we are using the react proxy dev configuration to proxy all request to the server (see `proxy` parameter at (`package.json`)[package.json] file)
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
HTTPS=true yarn start
```

