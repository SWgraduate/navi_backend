import { createApp } from 'src/app';
import { connectDB } from 'src/config/database';
import { logger, discordAlert } from "src/utils/log";
import { APP_PORT } from 'src/settings';
import { version } from '../package.json';


const startServer = async () => {
  logger.i(`Attempting to start server on version: ${version})...`);

  await connectDB();
  const app = createApp();
  const PORT = APP_PORT;
  app.listen(PORT, () => {
    logger.s(`Server is running on port ${PORT} (version: ${version})`);
  });
};

startServer();

