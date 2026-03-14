/**
 * 실행 방법 (프로젝트 최상단 기준):
 * npx ts-node -r tsconfig-paths/register tools/imageToBase64.ts <이미지경로>
 * 
 * 예시:
 * npx ts-node -r tsconfig-paths/register tools/imageToBase64.ts ./sample/test.png
 */

import fs from 'fs';
import path from 'path';
import { logger } from 'src/utils/log';

function main() {
  const imagePath = process.argv[2];

  if (!imagePath) {
    logger.e('이미지 경로가 제공되지 않았습니다.\n사용법: npx ts-node -r tsconfig-paths/register tools/imageToBase64.ts <이미지경로>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), imagePath);

  if (!fs.existsSync(absolutePath)) {
    logger.e(`파일을 찾을 수 없습니다: ${absolutePath}`);
    process.exit(1);
  }

  try {
    const fileBuffer = fs.readFileSync(absolutePath);
    const base64String = fileBuffer.toString('base64');

    logger.i(`변환 성공! (데이터 길이: ${base64String.length})\n\n👇 아래 문자열을 복사해서 Swagger 등에 사용하세요:\n`);
    console.log(base64String);
  } catch (error) {
    logger.e(`변환 중 오류 발생: ${(error as Error).message}`);
    process.exit(1);
  }
}

main();
