import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/erica-capstone';

    await mongoose.connect(mongoURI);

    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.warn('MongoDB Connection Error: Database features will be disabled.', error);
    // process.exit(1); // Allow app to run without DB
  }
};
