/**
 * Usage: pnpm tsx tools/forceRegisterUser.ts --email <email> --password <password>
 */
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { connectDB } from 'src/config/database';
import User from 'src/models/User';
import { GLOBAL_CONFIG, JWT_SECRET } from 'src/settings';
import { logger } from 'src/utils/log';

const argv = process.argv.slice(2);
const emailArgIndex = argv.indexOf('--email');
const passwordArgIndex = argv.indexOf('--password');

if (emailArgIndex === -1 || !argv[emailArgIndex + 1] || passwordArgIndex === -1 || !argv[passwordArgIndex + 1]) {
  logger.e('Usage: pnpm tsx tools/forceRegisterUser.ts --email <email> --password <password>');
  process.exit(1);
}

const email = argv[emailArgIndex + 1];
const password = argv[passwordArgIndex + 1];

async function main() {
  try {
    logger.i(`Connecting to database...`);
    await connectDB();

    logger.i(`Checking if user already exists: ${email}...`);
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.e(`Error: User with email ${email} already exists.`);
      process.exit(1);
    }

    logger.i(`Creating new user: ${email}...`);

    // User 모델 생성 (비밀번호는 모델의 pre-save 훅에서 자동 암호화됨)
    const newUser = new User({
      email,
      password,
      role: 'student' // 기본 역할
    });

    // 액세스 토큰 생성 및 설정 (정상적인 로그인 상태를 시뮬레이션하기 위함)
    const token = jwt.sign({ userId: newUser._id.toString() }, JWT_SECRET, {
      expiresIn: GLOBAL_CONFIG.jwtExpiresIn as any
    });
    newUser.activeToken = token;

    await newUser.save();

    logger.s(`User ${email} successfully registered without verification.`);
    logger.i(`User ID: ${newUser._id}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    logger.e('Error during force registration:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

main();
