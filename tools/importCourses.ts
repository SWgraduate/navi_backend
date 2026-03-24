// 실행 방법: npx ts-node tools/importCourses.ts <json_file_path> <development|production|test>
// 예시: npx ts-node tools/importCourses.ts out/courses_erica_2026_10.json development

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
  const args = process.argv.slice(2);
  const filePath = args[0];
  const envMap = args[1];

  if (!filePath || !envMap || !['development', 'production', 'test'].includes(envMap)) {
    console.error('사용법: npx ts-node tools/importCourses.ts <json_file_path> <development|production|test>');
    process.exit(1);
  }

  // 환경에 맞게 변수를 로딩할 수 있도록 NODE_ENV를 스크립트 단에서 덮어씁니다.
  process.env.NODE_ENV = envMap;

  // src/settings.ts, src/utils/log.ts 등의 모듈들이 강제 설정된 NODE_ENV를 참조할 수 있도록 동적 import 수행
  const { MONGO_URI } = await import('../src/settings');
  const { logger } = await import('../src/utils/log');

  if (!MONGO_URI) {
    logger.e('MONGO_URI가 설정되어 있지 않습니다.');
    process.exit(1);
  }

  logger.i(`[importCourses] 시작... 대상 환경: ${envMap}`);
  
  const absolutePath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolutePath)) {
    logger.e(`파일을 찾을 수 없습니다: ${absolutePath}`);
    process.exit(1);
  }

  // Course 스키마는 AcademicRecord 모델의 `takenCourses` 속성에 바탕하여 구성합니다.
  interface ICourse {
    courseCode: string;
    courseName: string;
    category: string;
    credit: number;
    department?: string;
    isEnglish: boolean;
    isPbl: boolean;
    isMajorPbl: boolean;
  }

  const CourseSchema = new mongoose.Schema({
    courseCode: { type: String, required: true, unique: true },  // 학수번호 (ex. ACC2051)
    courseName: { type: String, required: true },                // 과목명
    category: { type: String, required: true },                  // 이수구분 (ex. 전공핵심, 교양선택)
    credit: { type: Number, required: true },                    // 학점
    department: { type: String, required: false },               // 주관학과(소속) 추가 매핑
    isEnglish: { type: Boolean, default: false },                // 영어전용강좌 여부
    isPbl: { type: Boolean, default: false },                    // IC-PBL 강좌 여부
    isMajorPbl: { type: Boolean, default: false },               // 전공 IC-PBL 강좌 여부
  }, { timestamps: true });

  const Course = mongoose.models.Course || mongoose.model<ICourse>('Course', CourseSchema);

  try {
    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    const courses = JSON.parse(fileContent);

    if (!Array.isArray(courses)) {
      throw new Error('JSON 파일 내용이 배열이 아닙니다.');
    }

    logger.i(`[importCourses] MongoDB 연결 중... (${MONGO_URI})`);
    await mongoose.connect(MONGO_URI);
    logger.s('MongoDB 연결 됨');

    let inserted = 0;
    let updated = 0;

    for (const raw of courses) {
      // 핵심 식별자가 없는 쓰레기 값이면 패스
      if (!raw.haksuNo || !raw.gwamokNm) continue;

      // teuksuNm 속성에서 영어전용 / IC-PBL 여부 파악
      const teuksuNm = raw.teuksuNm || '';
      const isEnglish = teuksuNm.includes('영어') || teuksuNm.includes('English');
      const isPbl = teuksuNm.includes('IC-PBL') || teuksuNm.includes('PBL');
      
      const isuGbNm = raw.isuGbNm || '기타';
      const isMajor = isuGbNm.includes('전공');
      const isMajorPbl = Boolean(isPbl && isMajor);

      const doc = {
        courseCode: raw.haksuNo,
        courseName: raw.gwamokNm,
        category: isuGbNm,
        credit: raw.hakjeom || 0,
        department: raw.gnjSosokNm || '',
        isEnglish,
        isPbl,
        isMajorPbl
      };

      // 이미 있는 과목(학수번 기준)이면 갱신, 없으면 추가 (upsert: true)
      const result = await Course.updateOne(
        { courseCode: doc.courseCode },
        { $set: doc },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        inserted++;
      } else if (result.modifiedCount > 0) {
        updated++;
      }
    }

    logger.s(`데이터 가져오기 완료! (새로 추가: ${inserted}건, 업데이트: ${updated}건)`);

  } catch (error: any) {
    logger.e(`에러 발생: ${error.message}`);
  } finally {
    await mongoose.disconnect();
    logger.i('MongoDB 연결 종료.');
  }
}

run();
