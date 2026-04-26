// 실행 명령어: pnpm tsx tools/seedSuperuser.ts
import mongoose from 'mongoose';
import { connectDB } from '../src/config/database';
import { logger } from '../src/utils/log';
import User from '../src/models/User';
import { MASTER_EMAIL, MASTER_PASSWORD } from '../src/settings';

const seedAdmin = async () => {
  try {
    // 환경변수 체크
    if (!MASTER_EMAIL || !MASTER_PASSWORD) {
      logger.e('MASTER_EMAIL 또는 MASTER_PASSWORD 환경변수가 설정되어 있지 않습니다.');
      process.exit(1);
    }

    // DB 연결
    await connectDB();

    // 중복 생성 검사
    const existingAdmin = await User.findOne({ email: MASTER_EMAIL });
    if (existingAdmin) {
      logger.i(`이미 관리자 계정이 존재합니다. (Email: ${MASTER_EMAIL})`);
      process.exit(0);
    }

    // 관리자 계정 생성 (비밀번호는 User 모델 pre-save 훅이 자동 해싱)
    await User.create({
      email: MASTER_EMAIL,
      password: MASTER_PASSWORD,
      role: 'admin',
    });

    logger.s(`성공적으로 관리자(admin) 계정이 생성되었습니다.`);
    logger.i(`- Email: ${MASTER_EMAIL}`);
    logger.i('- Password: (환경변수에 설정된 비밀번호)');

    process.exit(0);
  } catch (error) {
    logger.e('관리자 계정 생성 중 오류 발생:', error);
    process.exit(1);
  }
};

seedAdmin();