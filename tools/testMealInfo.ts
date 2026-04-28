/**
 * Usage: pnpm tsx tools/testMealInfo.ts [date: YYYY-MM-DD]
 * Example: pnpm tsx tools/testMealInfo.ts 2026-04-27
 */
import { CampusLifeService } from 'src/services/CampusLifeService';
import { logger } from 'src/utils/log';

const argv = process.argv.slice(2);
const dateStr = argv[0];

async function main() {
  try {
    logger.i(`[testMealInfo] 학식 정보 크롤링 테스트 시작... (대상 날짜: ${dateStr || '오늘'})`);

    const service = new CampusLifeService();
    const resultRe11 = await service.getMealInfo(dateStr, 're11');
    const resultRe12 = await service.getMealInfo(dateStr, 're12');
    
    logger.s('[testMealInfo] 크롤링 성공');
    console.log('--- 교직원식당 ---');
    console.log(JSON.stringify(resultRe11, null, 2));
    console.log('--- 학생식당 ---');
    console.log(JSON.stringify(resultRe12, null, 2));
    
    process.exit(0);
  } catch (error) {
    logger.e('[testMealInfo] 크롤링 실패', error);
    process.exit(1);
  }
}

main();
