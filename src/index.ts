import dotenv from 'dotenv';
import { createApp } from './app';
import { connectDB } from './config/database';

dotenv.config();

const startServer = async () => {
  await connectDB();
  const app = createApp();
  const PORT = process.env.PORT || 3000;

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

startServer();
