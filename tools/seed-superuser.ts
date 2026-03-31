// 실행 명령어: pnpm tsx tools/seed-superuser.ts
import mongoose from 'mongoose';
import { connectDB } from '../src/config/database';
import { logger } from '../src/utils/log';
import User from '../src/models/User';
import dotenv from 'dotenv';
import path from 'path';

// 주로 로컬 환경(.env.development)을 바라보게 함
dotenv.config({ path: path.join(__dirname, '../.env.development') });

const seedAdmin = async () => {
  // 프로덕션 환경에서는 실행 상면 방지
  if (process.env.NODE_ENV === 'production') {
    logger.e('운영(Production) 환경에서는 슈퍼유저 시드 스크립트를 실행할 수 없습니다.');
    process.exit(1);
  }

  try {
    // DB 연결
    await connectDB();

    const adminEmail = 'admin@test.com';
    const adminPassword = 'Test000000**';

    // 중복 생성 검사
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      logger.i(`이미 관리자 계정이 존재합니다. (Email: ${adminEmail})`);
      process.exit(0);
    }

    // 관리자 계정 생성 (비밀번호는 User 모델 pre-save 훅이 자동 해싱)
    await User.create({
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
    });

    logger.s(`성공적으로 관리자(admin) 계정이 생성되었습니다.`);
    logger.i(`- Email: ${adminEmail}`);
    logger.i(`- Password: ${adminPassword}`);
    
    process.exit(0);
  } catch (error) {
    logger.e('관리자 계정 생성 중 오류 발생:', error);
    process.exit(1);
  }
};

seedAdmin();