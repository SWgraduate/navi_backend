import mongoose from 'mongoose';
import { logger } from 'src/utils/log';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erica-capstone';
    await mongoose.connect(mongoURI);
    logger.s('MongoDB Connected Successfully');
  } catch (error) {
    logger.e('MongoDB Connection Error: Database features will be disabled.', error);
  }
};
