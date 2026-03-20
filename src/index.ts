import { createApp } from 'src/app';
import { connectDB } from 'src/config/database';
import { APP_PORT, NODE_ENV } from 'src/settings';
import { logger, discordAlert } from "src/utils/log";
import { version } from '../package.json';


const startServer = async () => {
  const startupMessage = `Starting server on ${NODE_ENV}-v${version}...`;
  const runningMessage = `Server is running on port ${APP_PORT} (${NODE_ENV}-v${version})`;
  logger.i(startupMessage);
  await discordAlert(startupMessage);

  await connectDB();
  const app = createApp();
  const PORT = APP_PORT;
  app.listen(PORT, async () => {
    logger.s(runningMessage);
    await discordAlert(runningMessage);
  });
};

startServer();

