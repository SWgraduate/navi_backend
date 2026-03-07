import dotenv from 'dotenv';

dotenv.config();

import { createApp } from 'src/app';
import { connectDB } from 'src/config/database';
import { logger } from 'src/utils/log';

const startServer = async () => {
  await connectDB();
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    logger.i(`Server is running on port ${PORT}`);
  });
};

startServer();
