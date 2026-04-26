/**
 * Usage: pnpm tsx tools/forceDeleteUser.ts --email <email>
 */
import mongoose from 'mongoose';
import { connectDB } from 'src/config/database';
import User from 'src/models/User';
import { AuthService } from 'src/services/AuthService';
import { logger } from 'src/utils/log';

const argv = process.argv.slice(2);
const emailArgIndex = argv.indexOf('--email');

if (emailArgIndex === -1 || !argv[emailArgIndex + 1]) {
  logger.e('Usage: pnpm tsx tools/forceDeleteUser.ts --email <email>');
  process.exit(1);
}

const email = argv[emailArgIndex + 1];

async function main() {
  try {
    logger.i(`Connecting to database...`);
    await connectDB();

    logger.i(`Searching for user with email: ${email}...`);
    const user = await User.findOne({ email });
    
    if (!user) {
      logger.e(`User not found with email: ${email}`);
      process.exit(1);
    }

    const userId = user._id.toString();
    logger.i(`Found user: ${email} (ID: ${userId})`);
    logger.i(`Initiating cascading delete via AuthService...`);

    // AuthService.leave 호출로 트랜잭션 기반 연쇄 삭제 수행
    await AuthService.getInstance().leave(userId);

    logger.s(`User and all associated data successfully deleted.`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.e('Error during force delete:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
