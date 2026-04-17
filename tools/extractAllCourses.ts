// 실행 명령어: pnpm tsx tools/extractAllCourses.ts

import { logger } from 'src/utils/log';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.PORTAL_TOKEN || !process.env.PORTAL_COOKIE) {
  logger.c('환경 변수 PORTAL_TOKEN 또는 PORTAL_COOKIE가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
} else {
  logger.s('환경 변수 확인 완료: PORTAL_TOKEN과 PORTAL_COOKIE가 설정되어 있습니다.');
}

// --- 설정 파라미터 ---
const CONFIG = {
  // 토큰값 (만료 시 브라우저에서 새로 복사 필요)
  tk: process.env.PORTAL_TOKEN,
  strJojik: 'Y0000316', // ERICA 기초융합교육원(또는 공통교양/대학 조직) 코드
  strSuupYear: '2026',
  strSuupTerm: '10', // 10: 1학기 (20: 2학기, 11: 여름, 21: 겨울 등)
  maxRows: 500, // 한 번에 가져올 데이터 수 (시간 단축을 위해 500으로 상향 조정)
  outputFile: 'courses_erica.json', // 저장될 파일명
  cookie: process.env.PORTAL_COOKIE
};

// 1~2초 랜덤 딜레이 함수
const randomDelay = () => {
  const ms = Math.floor(Math.random() * 1000) + 1000; // 1000ms ~ 2000ms
  return new Promise((resolve) => setTimeout(resolve, ms));
};

async function fetchCoursesPage(skipRows: number): Promise<{ list: any[]; totalCnt: number }> {
  const url = `https://portal.hanyang.ac.kr/sugang/SgscAct/findSuupSearchSugangSiganpyo.do?pgmId=P310278&menuId=M006631&tk=${CONFIG.tk}`;

  const payload = {
    skipRows: skipRows.toString(),
    maxRows: CONFIG.maxRows.toString(),
    strLocaleGb: "ko",
    strIsSugangSys: "true",
    strDetailGb: "0",
    notAppendQrys: "true",
    strSuupOprGb: "0",
    strJojik: CONFIG.strJojik,
    strSuupYear: CONFIG.strSuupYear,
    strSuupTerm: CONFIG.strSuupTerm,
    strIsuGrade: "",
    strTsGangjwa: "",
    strTsGangjwaAll: "0",
    strTsGangjwa3: "0",
    strIlbanCommonGb: "",
    strIsuGbCd: "",
    strHaksuNo: "",
    strChgGwamok: "",
    strGwamok: "",
    strDaehak: "",
    strHakgwa: "",
    strYeongyeok: "",
    strPgmNm: ""
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "content-type": "application/json+sua; charset=UTF-8",
      "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Google Chrome\";v=\"146\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"Windows\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "XMLHttpRequest",
      "cookie": CONFIG.cookie,
      "Referer": "https://portal.hanyang.ac.kr/sugang/sulg.do"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
  }

  const responseText = await response.text();
  let data;
  try {
    data = JSON.parse(responseText);
  } catch (error) {
    logger.e('JSON 파싱 실패. 응답 내용:');
    logger.e(responseText);
    throw new Error('서버에서 올바른 JSON을 반환하지 않았습니다. 세션이 만료되었거나 접근이 거부되었을 수 있습니다.');
  }

  const dataset = data?.DS_SUUPGS03TTM01?.[0];

  if (!dataset || !dataset.list) {
    throw new Error('응답 데이터에 DS_SUUPGS03TTM01 또는 list가 없습니다.');
  }

  const list = dataset.list;
  // 목록이 비어있으면 totalCnt 0 반환
  const totalCnt = list.length > 0 ? list[0].totalCnt : 0;

  return { list, totalCnt };
}

async function main() {
  logger.i('학교에 등록된 전체 강의 목록 추출 스크립트 실행 시작');
  logger.i(`설정: ${CONFIG.strSuupYear}년도 ${CONFIG.strSuupTerm}학기 | 캠퍼스: ${CONFIG.strJojik}`);

  let skipRows = 0;
  let totalCnt = -1; // 초기화
  const allCourses: any[] = [];

  while (true) {
    logger.i(`데이터 요청 중... (skipRows: ${skipRows})`);

    const { list, totalCnt: currentTotalCnt } = await fetchCoursesPage(skipRows);

    if (list.length === 0) {
      logger.i('더 이상 가져올 데이터가 없습니다. 반복을 종료합니다.');
      break;
    }

    if (totalCnt === -1) {
      totalCnt = currentTotalCnt;
      logger.i(`총 검색된 강의 수: ${totalCnt}`);
    }

    allCourses.push(...list);
    logger.i(`현재까지 수집된 강의 수: ${allCourses.length} / ${totalCnt}`);

    skipRows += CONFIG.maxRows;

    if (skipRows >= totalCnt) {
      break;
    }

    // 서버 부하 방지를 위한 랜덤 딜레이 (1~2초)
    logger.i('다음 요청 전 대기 중 (1~2초 랜덤)...');
    await randomDelay();
  }

  const outputDir = path.resolve(process.cwd(), 'out');
  const outputPath = path.resolve(outputDir, CONFIG.outputFile);

  // out 폴더가 없으면 생성
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    // 무시
  }

  await fs.writeFile(outputPath, JSON.stringify(allCourses, null, 2), 'utf-8');

  logger.i(`완료! 총 ${allCourses.length}개의 강의를 ${outputPath} 에 저장했습니다.`);
}

main().catch((error) => {
  logger.e('스크립트 실행 중 오류 발생:', error);
  process.exit(1);
});
