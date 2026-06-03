// 실행 명령어: pnpm tsx tools/seedSuperuser.ts
import dotenv from 'dotenv';
import path from 'path';

const envName = process.env.NODE_ENV || 'development';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`) });

const seedAdmin = async () => {
  const MASTER_EMAIL = process.env.MASTER_EMAIL;
  const MASTER_PASSWORD = process.env.MASTER_PASSWORD;
  const MONGO_URI = process.env.MONGO_URI;

  if (!MASTER_EMAIL || !MASTER_PASSWORD) {
    console.error('MASTER_EMAIL 또는 MASTER_PASSWORD 환경변수가 설정되어 있지 않습니다.');
    process.exit(1);
  }

  if (!MONGO_URI) {
    console.error('MONGO_URI 환경변수가 설정되어 있지 않습니다.');
    process.exit(1);
  }

  const mongoose = (await import('mongoose')).default;
  const User = (await import('../src/models/User')).default;

  try {
    await mongoose.connect(MONGO_URI);
    console.log('MongoDB Connected Successfully');

    const existingAdmin = await User.findOne({ email: MASTER_EMAIL });
    if (existingAdmin) {
      console.log(`이미 관리자 계정이 존재합니다. (Email: ${MASTER_EMAIL})`);
      process.exit(0);
    }

    await User.create({
      email: MASTER_EMAIL,
      password: MASTER_PASSWORD,
      role: 'admin',
    });

    console.log('성공적으로 관리자(admin) 계정이 생성되었습니다.');
    console.log(`- Email: ${MASTER_EMAIL}`);
    console.log('- Password: (환경변수에 설정된 비밀번호)');

    process.exit(0);
  } catch (error) {
    console.error('관리자 계정 생성 중 오류 발생:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
};

seedAdmin();
