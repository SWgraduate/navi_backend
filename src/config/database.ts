import mongoose from 'mongoose';
import { logger } from 'src/utils/log';
import { MONGO_URI } from 'src/settings';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGO_URI);
    logger.s('MongoDB Connected Successfully');
    logger.i(`MongoDB DB name: ${mongoose.connection.name}`);
  } catch (error) {
    logger.e('MongoDB Connection Error: Database features will be disabled.', error);
  }
};
