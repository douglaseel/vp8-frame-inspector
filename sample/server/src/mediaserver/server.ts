import http from 'http';
import { promisify } from "util";
import SocketIO from 'socket.io';
import express from 'express';

import { Manager } from './manager';


export class Server {
  private readonly manager = new Manager();
  private app?: express.Express;
  private server?: http.Server;
  private io?: SocketIO.Server;

  constructor () {
    this.configureRestService();
    this.configureSocketIOService();
  }

  async load () {
    await this.manager.load();
  }

  listen (port: number, fn: () => void) : void {
    this.server!.listen(port, fn);
  }

  private configureRestService () : void {
    const app = express();
    app.use(express.json());

    app.post('/api/v1/room', async (req, res) => {
      try {
        const roomId = await this.manager.createRoom(req.body.appData);
        res.status(201).send({ roomId });
      } catch (error) {
        console.error(error);
        res.sendStatus(500);
      }
    })

    app.get('/api/v1/rooms/:roomId', (req, res) => {
      try {
        const roomId = req.params.roomId;
        const appData = this.manager.getRoomAppData(roomId);
        res.status(200).send({ appData });
      } catch (error) {
        console.error(error);
        res.sendStatus(500);
      }
    })

    this.app = app;
    this.server = http.createServer(this.app);
  }

  private configureSocketIOService () : void {
    const io = new SocketIO.Server(this.server, { 
      path: '/api/v1/ws',
      pingInterval: 10000, 
      pingTimeout: 15000 
    });

    io.on('connection', async (socket: SocketIO.Socket) : Promise<void> => {
      try {
        const roomId = socket.handshake.query.roomId;
        // @ts-ignore
        socket.emitAsync = promisify(socket.emit);
        await this.manager.joinRoom(<string>roomId, socket);
      } catch (error) {
        console.error(error);
        socket.disconnect(true);
      }
    });

    this.io = io;
  }

}