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

const MAJOR_RULES: Record<string, { type: 'split' | 'bypass'; sub?: string[]; target?: string }> = {
  // Case 1 & 2: 공과대학
  "건축학부": {
    type: "split",
    sub: ["건축학전공", "건축공학전공"]
  },
  "스마트융합공학부": {
    type: "split",
    sub: ["소재·부품융합전공", "로봇융합전공", "스마트ICT융합전공", "건축IT융합전공", "지속가능건축융합전공"]
  },

  // Case 3: 소프트웨어융합대학
  "컴퓨터학부": {
    type: "split",
    sub: ["컴퓨터전공", "지능형클라우드전공"]
  },
  "ICT융합학부": {
    type: "split",
    sub: ["데이터인텔리전스전공", "디자인컨버전스전공"]
  },
  "융합전공": {
    type: "split",
    sub: ["신산업소프트웨어전공", "산업인공지능전공", "디자인공학전공"]
  },

  // Case 2: 첨단융합대학 / 예체능대학
  "차세대반도체융합공학부": { type: "split", sub: ["신소재반도체공학전공", "반도체디스플레이공학전공"] },
  "바이오신약융합학부": { type: "split", sub: ["분자의약전공", "바이오나노공학전공"] },
  "국방지능정보융합공학부": { type: "split", sub: ["지능형시스템공학전공", "국방전략기술공학과"] },
  "스포츠과학부": { type: "split", sub: ["스포츠문화전공", "스포츠코칭전공"] },

  // 단과대만 있는 케이스
  "약학대학": { type: "bypass", target: "약학대학" },
  "LIONS칼리지": { type: "bypass", target: "LIONS칼리지" }
};

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

      let rawDept = cells.eq(0).text().trim().replace(/\s+/g, ' ');
      if (!rawDept) return;

      // 1. 괄호가 있으면 괄호 안의 내용을 분리 대상 문자열로 추출
      let processText = rawDept;
      const parenMatch = processText.match(/\((.*?)\)/);
      if (parenMatch) {
        processText = parenMatch[1] || '';
      }

      // 2. 쉼표나 '및'을 기준으로 분리
      const tokens = processText.split(/,| 및 /).map(s => s.trim()).filter(Boolean);

      tokens.forEach(token => {
        // 중복 추가 방지
        const isExists = (name: string) => currentCollege!.departments.some(d => d.name === name);

        const rule = MAJOR_RULES[token];
        if (rule) {
          if (rule.type === 'split' && rule.sub) {
            rule.sub.forEach(sub => {
              if (!isExists(sub)) {
                currentCollege!.departments.push({ name: sub });
              }
            });
          } else if (rule.type === 'bypass' && rule.target) {
            if (!isExists(rule.target)) {
              currentCollege!.departments.push({ name: rule.target });
            }
          }
        } else {
          if (!isExists(token)) {
            currentCollege!.departments.push({ name: token });
          }
        }
      });
    });

    // 단과대 이름 자체가 bypass 룰에 포함되고 학과(표)가 없을 경우 대비
    for (const college of colleges) {
      if (college.departments.length === 0) {
        const rule = MAJOR_RULES[college.name];
        if (rule && rule.type === 'bypass' && rule.target) {
          college.departments.push({ name: rule.target });
        }
      }
    }

    if (colleges.length === 0) {
      console.log('[실패] 데이터를 찾지 못했습니다. 셀렉터를 확인하세요.');
      return;
    }

    const result: Record<string, string[]> = {};
    for (const college of colleges) {
      if (college.departments.length > 0) {
        result[college.name] = college.departments.map(dept => dept.name);
      } else {
        result[college.name] = [];
      }
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('데이터를 가져오는 데 실패했습니다: ', error);
  }
}

fetchMajors();