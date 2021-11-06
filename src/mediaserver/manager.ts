import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { createWorker, types as mediasoupTypes } from 'mediasoup';

import { EnhancedSocket } from './types';
import { Settings } from '../settings';
import { Room } from './room';

export class Manager {
  private readonly workers: mediasoupTypes.Worker[] = [];
  private readonly rooms: Map<string, Room> = new Map();

  async load () : Promise<void> {
    const numOfWorkers = os.cpus().length;
    const workerSettings = Settings.getWorkerSettings();
    console.log(`Initializing ${numOfWorkers} workers`);
    for (let i = 0; i < numOfWorkers; i++) {
      const worker = await createWorker(workerSettings);
      this.workers.push(worker);
    }
  }

  async createRoom (appData: object) : Promise<string> {
    const id = uuidv4()
    const worker = await this.getAvailableWorker()

    const routerOptions = Settings.getRouterOptions();
    const router = await worker.createRouter(routerOptions);

    const listenIps: mediasoupTypes.TransportListenIp[] = [];
    const announcedIps = Settings.getAnnouncedIps();
    const ifaces = os.networkInterfaces();
    Object.keys(ifaces).forEach(ifname => {
      ifaces[ifname]!.forEach(iface => {
        if (iface.family !== 'IPv4' || iface.internal !== false) {
          return;
        }

        if (announcedIps?.length) {
          announcedIps.forEach(announcedIp => listenIps.push({ ip: iface.address, announcedIp }));
        } else {
          listenIps.push({ ip: iface.address });
        }
      })
    })

    const transportOptions = { listenIps }
    const room = new Room(id, appData, router, transportOptions);

    this.rooms.set(id, room);

    room.on('maxIdleTimeExceeded', async () => {
      this.rooms.delete(id);
      room.close();
    })

    return id;
  }

  async deleteRoom (roomId : string) : Promise<void> {
    const room = this.getRoom(roomId);
    this.rooms.delete(roomId);
    room.close();
  }

  async joinRoom (socket: EnhancedSocket, roomId: string) {
    const room = this.getRoom(roomId);
    await room.addPeer(socket);
  }

  private async getAvailableWorker () : Promise<mediasoupTypes.Worker> {
    const workersResources = await Promise.all(this.workers.map(worker => worker.getResourceUsage()))
    const workersUserTime = workersResources.map(resource => resource.ru_utime);
    const workerIndex = workersUserTime.indexOf(Math.min(...workersUserTime))
    return this.workers[workerIndex]
  }

  private getRoom (roomId: string) : Room {
    const room = this.rooms.get(roomId)
    if (!room) {
      throw new Error('Room does not exist!')
    }
    return room;
  }
}