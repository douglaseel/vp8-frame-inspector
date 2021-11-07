import { Server } from './mediaserver/server';
import { Settings } from "./settings";


const main = async () : Promise<void> => {
  const server = new Server();
  await server.load();
  const port = Settings.getPort();
  server.listen(port, () => {
    console.log(`Service listening port ${port}`);
  });
}

main();