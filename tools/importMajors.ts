// 실행 명령어: pnpm tsx tools/importMajors.ts

import axios from 'axios';
import * as cheerio from 'cheerio';

interface Department {
  name: string;
}

interface College {
  name: string;
  departments: Department[];
}

async function fetchMajors() {
  const url = 'https://www.hanyang.ac.kr/web/www/e_college_department-info';

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const colleges: College[] = [];
    let currentCollege: College | null = null;

    // 핵심: DOM 탐색 대신, 문서 순서대로 요소를 한 번에 순회
    // 배너를 만나면 → 새 대학 시작
    // table tr을 만나면 → 현재 대학의 학과 추가
    $('#content .hyu-fragment-component-lineBanner, #content table tr').each((_, el) => {
      const elem = $(el);

      // 대학 배너 발견 → 새 대학 시작
      if (elem.hasClass('hyu-fragment-component-lineBanner')) {
        const name = elem
          .find('strong').first().text()
          .replace(/⌂/g, '')
          .replace(/\s+/g, ' ')
          .trim();

        if (!name) return;
        currentCollege = { name, departments: [] };
        colleges.push(currentCollege);
        return;
      }

      // 배너가 아직 없으면 건너뜀 (헤더/네비 테이블 방지)
      if (!currentCollege) return;

      // 학과 행 파싱
      const cells = elem.children('td');
      if (cells.length < 1) return;

      const deptName = cells.eq(0).text().trim().replace(/\s+/g, ' ');
      if (deptName) {
        currentCollege.departments.push({ name: deptName });
      }
    });

    if (colleges.length === 0) {
      console.log('[실패] 데이터를 찾지 못했습니다. 셀렉터를 확인하세요.');
      return;
    }

    for (const college of colleges) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`대학명 : ${college.name}`);
      if (college.departments.length > 0) {
        console.log(`학과 목록 :`);
        for (const dept of college.departments) {
          console.log(`  - ${dept.name}`);
        }
      } else {
        console.log();
      }
    }

  } catch (error) {
    console.error('데이터를 가져오는 데 실패했습니다: ', error);
  }
}

fetchMajors();