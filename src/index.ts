import { createApp } from 'src/app';
import { connectDB } from 'src/config/database';
import { logger } from 'src/utils/log';
import { APP_PORT } from 'src/settings';

const startServer = async () => {
  await connectDB();
  const app = createApp();
  const PORT = APP_PORT;

  app.listen(PORT, () => {
    logger.i(`Server is running on port ${PORT}`);
  });
};

startServer();
