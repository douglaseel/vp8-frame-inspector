# How to test it locally?

## 1. Build the `inspector` tool

```shell
cd inspector
make
```

## 2. Starting the server sample

Open a terminal and exec

```shell
cd sample/server
yarn install
yarn dev
```

After this command the server should be listening the `5555` port.


## 3. Starting the client sample

Open another terminal and exec

```shell
cd sample/client
yarn install
HTTPS=true yarn start
```

The client should be up in the port `3000` or other (if anyone is already listening to this port).

**NOTE:**: you should up the server first because we are using a proxy in the client to do the requests to the server (see `proxy` config in [package.json](sample/client/package.json) file)


## 4. Creating a meeting =)

1. Open a browser at client page (usually https://127.0.0.1:3000/);
2. Create a new room with a cute name;
3. Add your name and confirm;
4. Congratulation! You are in a very SIMPLE meeting.


## 5. Start to inspecting =)

Inside a meeting you can start your webcam streaming. When you do it, the SFU will receive your RTP packets and send them to the `inspector` tool.

You propably will note that a folder called `inspector-results` was created in the project root folder. 
Inside this folder you will see one file per video streaming using VP8.

The name of file should be the `<SSRC>.log`.

**NOTE:** the `ssrc` used in the rtp consumed is different from the produced in the browser because mediasoup does it. 


## 6. Check the RESULTS!