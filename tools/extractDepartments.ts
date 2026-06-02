// 실행 명령어: pnpm ts-node -r tsconfig-paths/register tools/extractDepartments.ts
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

//경로 잡기
const currentDir = __dirname;
const dirPath = path.join(currentDir, '..', 'out');
const filePath = path.join(dirPath, 'init_valid_departments.json');

//폴더 만들기
const run = async () => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  }
  catch (error) {
    console.log(error);
    process.exit(1);
  }
}

interface Department {
  name: string;
  majors: string[];
}

interface College {
  name: string;
  departments: Department[];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function splitMajors(text: string): string[] {
  // (전공1, 전공2)형태에서 전공 구분자를 범용적으로 처리
  return text
    .split(/,|，| 및 /g)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

function parseDepartmentAndMajors(rawText: string): Department {
  const normalized = normalizeText(rawText);

  // 건축학부 (건축학전공, 건축공학전공)
  const match = normalized.match(/^(.+?)\s*[\(\uff08]([^\)\uff09]+)[\)\uff09]$/);
  if (!match) {
    // 스마트융합공학부 소재·부품융합전공
    const prefixMajorMatch = normalized.match(/^(.+?(?:학부|공학부))\s+(.+)$/);
    if (!prefixMajorMatch) {
      return { name: normalized, majors: [] };
    }

    const deptNameRaw = prefixMajorMatch[1];
    const majorNameRaw = prefixMajorMatch[2];

    if (!deptNameRaw || !majorNameRaw) {
      return { name: normalized, majors: [] };
    }

    return {
      name: normalizeText(deptNameRaw),
      majors: [normalizeText(majorNameRaw)],
    };
  }

  const deptName = match[1];
  const majorsText = match[2];
  if (!deptName || !majorsText) {
    return { name: normalized, majors: [] };
  }

  return {
    name: normalizeText(deptName),
    majors: splitMajors(majorsText),
  };
}

async function fetchMajors() {
  const url = 'https://www.hanyang.ac.kr/web/www/e_college_department-info';

  try {
    await run();
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    const $ = cheerio.load(response.data);
    const colleges: College[] = [];
    
    $('h2.main-title').each((_, el) => {
      const collegeName = normalizeText($(el).text());
      if (!collegeName) return;

      // 현재 페이지 구조(main-title/dept-container/dept-btn) 기준으로 파싱
      const $deptContainer = $(el)
        .closest('div.headcopy')
        .siblings('div.dept-container');

      const departments: Department[] = [];

      $deptContainer.find('a.dept-btn').each((_, deptEl) => {
        const rawText = $(deptEl)
          .clone()
          .children('svg')
          .remove()
          .end()
          .text();

        const text = normalizeText(rawText);
        if (!text) return;

        const parsed = parseDepartmentAndMajors(text);
        const existing = departments.find((d) => d.name === parsed.name);
        if (!existing) {
          departments.push(parsed);
          return;
        }

        // 같은 department로 인식되는 경우 major를 누적
        for (const major of parsed.majors) {
          if (!existing.majors.includes(major)) {
            existing.majors.push(major);
          }
        }
      });

      colleges.push({ name: collegeName, departments });
    });

    if (colleges.length === 0) {
      console.log('[실패] 데이터를 찾지 못했습니다. 셀렉터를 확인하세요.');
      return;
    }

    const departmentsByCollege: Record<string, string[]> = {};
    for (const college of colleges) {
      departmentsByCollege[college.name] = college.departments.map((d) => d.name);
    }

    const result = {
      departmentsByCollege,
      colleges,
    };

    await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('데이터를 가져오는 데 실패했습니다: ', error);
    process.exitCode = 1;
  }
}

fetchMajors();

