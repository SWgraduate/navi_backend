import { SECOND_MAJOR } from 'src/models/Student';

export interface GraduationRequirements {
  requiredCredits: {
    gpa: number;
    total: number;
    majorCore: number;
    majorAdvanced: number;
    majorTotal: number;
    generalElective: number;
    socialService: number;
    industry: number;
  };
  requiredSecondMajorCredits?: {
    majorTotal: number;
    majorCore: number;
  };
  requiredConditions: {
    englishCourses: number;
    pblTotal: number;
    pblMajor: number;
    hasPrerequisite: boolean;
    hasMandatoryCourse: boolean;
    hasThesis: boolean;
  };
}

export class GraduationService {
  /**
   * 학생 정보 기반으로 총 졸업 학점을 계산합니다.
   */
  public static getTotalCredits(major: string): number {
    if (major.includes('건축학')) return 162;
    if (['융합시스템공학', '스마트융합공학', '회계세무학'].some(m => major.includes(m))) return 120;

    // TODO: 약학대학 6년제(231)와 2+4년제(150) 구분을 학번에 따라 자동으로 할 수 있도록 로직 고도화 필요 (26. 4. 28., Gemini)
    if (major.includes('약학')) return 231;

    if ((major.includes('소프트웨어융합대학') || major.includes('컴퓨터학부')) && !major.includes('수리데이터사이언스')) return 140;
    if (major.includes('융합보안학')) return 140;

    if (['글로벌문화통상', '국제문화', '커뮤니케이션', '경상', '디자인', '예체능'].some(m => major.includes(m))) {
      return 126;
    }

    return 130;
  }

  /**
   * 전공 학점을 계산합니다. (다전공, 편입, 학번 분기)
   */
  public static getMajorCredits(major: string, admissionYear: number, isTransfer: boolean, hasSecondMajor: boolean) {
    // TODO: 다전공(주전공, 다중전공, 부전공, 복수전공) 선택 시 각 트랙별 요구 학점이 복잡하게 달라지는 테이블 전체 매핑 로직 구현 필요 (26. 4. 28., Gemini)
    // TODO: 건축학전공은 2025학번 신입생, 2023학번 편입생부터 기준이 타 학과(24기준)와 상이하게 적용되므로 연도별 보정 로직 추가 필요 (26. 4. 28., Gemini)

    const isPost2024 = admissionYear >= 2024;
    let core = 0;
    let advanced = 0;
    let total = 0;

    if (major.includes('건축학')) {
      core = isTransfer ? 63 : (isPost2024 ? 90 : 118);
      advanced = isTransfer ? 18 : (isPost2024 ? 18 : 0);
      total = isTransfer ? 81 : (isPost2024 ? 108 : 118);
    } else if (major.includes('융합시스템공학')) {
      total = isTransfer ? 51 : 81;
    } else if (major.includes('스마트융합공학')) {
      total = major.includes('스마트컨스트럭션') ? 90 : 96;
    } else if (major.includes('지능형로봇') || major.includes('융합보안학')) {
      total = 60;
    } else if (major.includes('약학')) {
      total = 186; // TODO: 약대 구체적인 편입/신입학번별 전공 계 매핑 필요 (26. 4. 28., Gemini)
      core = 136;
      advanced = 0;
    } else if (major.includes('회계세무학')) {
      total = isTransfer ? 39 : 81;
    } else if (major.includes('수리데이터사이언스')) {
      core = 30;
      advanced = isTransfer ? 9 : (isPost2024 ? 18 : 21);
      total = isTransfer ? 39 : 60;
    } else if (major.includes('소프트웨어융합대학') || major.includes('컴퓨터학부')) {
      core = 36;
      advanced = isTransfer ? 9 : (isPost2024 ? 24 : 30);
      total = isTransfer ? 45 : 75;
    } else if (major.includes('커뮤니케이션') || (major.includes('경상') && !major.includes('회계세무'))) {
      if (['광고홍보', '미디어', '경상'].some(m => major.includes(m))) {
        core = 30;
        advanced = isTransfer ? 9 : (isPost2024 ? 15 : 18);
        total = isTransfer ? 39 : 54;
      } else {
        core = 30;
        advanced = isTransfer ? 9 : (isPost2024 ? 18 : 21);
        total = isTransfer ? 39 : 60;
      }
    } else {
      // 그 외 공통 (공과대학 일반, 첨단융합, 국제문화, 디대, 예체능 등)
      core = 30;
      advanced = isTransfer ? 9 : (isPost2024 ? 18 : 21);
      total = isTransfer ? 39 : 60;
    }

    if (hasSecondMajor) {
      total = core + advanced;
    }

    return { core, advanced, total };
  }

  /**
   * 교양 선택 영역 최소 이수 학점을 계산합니다.
   */
  public static getGeneralElectiveCredits(major: string): number {
    if (major.includes('스마트융합공학')) return 0;
    if (major.includes('융합시스템공학') || major.includes('회계세무학')) return 6;
    // TODO: 19학번 이전, 혹은 교양선택 세부 배당 학과별 룰베이스 필요시 추가 (26. 4. 28., Gemini)
    return 10;
  }

  /**
   * 영어, PBL, 사회봉사, 산학협력 조건 학점을 계산합니다.
   */
  public static getConditions(major: string, isTransfer: boolean) {
    let pblTotal = isTransfer ? 2 : 4;
    let pblMajor = 1;
    let englishCourses = 2;
    let socialService = 1;
    let industry = 6;

    let hasPrerequisite = true;
    let hasMandatoryCourse = true;
    let hasThesis = true;

    // TODO: 사회봉사, 산학협력 등 학번에 따라 (2021학번~2024학번, 2025학번 이후 등) 캡스톤 최대 이수 가능학점 분기 추가 구현 필요 (26. 4. 28., Gemini)

    if (['융합시스템', '스마트융합', '국방전략기술', '약학', '회계세무'].some(m => major.includes(m))) {
      pblTotal = 0;
      pblMajor = 0;
    }

    if (['융합시스템', '스마트융합', '약학', '회계세무', '예체능', '스포츠', '무용', '실용음악'].some(m => major.includes(m))) {
      englishCourses = 0;
    }

    if (['융합시스템', '스마트융합', '회계세무'].some(m => major.includes(m))) {
      socialService = 0;
      industry = 0;
    } else if (major.includes('약학(2+4)')) {
      socialService = 0;
      industry = 3;
    } else if (['에너지바이오', '해양융합', '수리데이터사이언스', '분자의약', '지능정보양자', '국제문화', '글로벌문화통상', '커뮤니케이션', '경상', '디자인', '예체능'].some(m => major.includes(m))) {
      industry = 3;
    }

    if (['분자의약', '지능정보양자', '국방전략기술', '글로벌문화통상', '국제문화', '경상', '스포츠문화', '스포츠코칭'].some(m => major.includes(m)) ||
      (major.includes('커뮤니케이션') && !major.includes('문화인류'))) {
      hasThesis = false;
    }

    return { pblTotal, pblMajor, englishCourses, socialService, industry, hasPrerequisite, hasMandatoryCourse, hasThesis };
  }

  /**
   * 특정 학생의 전체 졸업 요건을 계산합니다.
   */
  public static calculateRequirements({
    major,
    admissionYear,
    isTransfer = false,
    secondMajorType = null
  }: {
    major: string;
    admissionYear: number;
    isTransfer?: boolean;
    secondMajorType?: string | null;
  }): GraduationRequirements {

    // TODO: 프론트엔드에서 넘어오는 major가 정확히 단과대명인지 학과명인지, 두개가 혼재되어 넘어오는지에 대한 입력값 정제(Validation) 로직 추가 논의 요망 (26. 4. 28., Gemini)
    const hasSecondMajor = !!secondMajorType && secondMajorType !== SECOND_MAJOR.MINOR;

    const totalCredits = this.getTotalCredits(major);
    const majorCredits = this.getMajorCredits(major, admissionYear, isTransfer, hasSecondMajor);
    const generalElective = this.getGeneralElectiveCredits(major);
    const conditions = this.getConditions(major, isTransfer);

    const result: GraduationRequirements = {
      requiredCredits: {
        gpa: 1.75, // NOTE: 향후 평점에 대한 변동이 생길 수 있음 (26. 4. 28., 태영)
        total: totalCredits,
        majorCore: majorCredits.core,
        majorAdvanced: majorCredits.advanced,
        majorTotal: majorCredits.total,
        generalElective: generalElective,
        socialService: conditions.socialService,
        industry: conditions.industry
      },
      requiredConditions: {
        englishCourses: conditions.englishCourses,
        pblTotal: conditions.pblTotal,
        pblMajor: conditions.pblMajor,
        hasPrerequisite: conditions.hasPrerequisite,
        hasMandatoryCourse: conditions.hasMandatoryCourse,
        hasThesis: conditions.hasThesis
      }
    };

    if (hasSecondMajor) {
      // TODO: 다전공 구분에 따른 요구 학점(전공핵심/전공심화/전공계) 상세 산출 로직 구현 필요 (26. 4. 28., Gemini)
      result.requiredSecondMajorCredits = {
        majorTotal: 36, // TODO: 다전공 요건 확정 전까지 임시값 사용 중. 에러 반환 또는 null 처리 검토 (26. 4. 29., 정태영)
        majorCore: 18   // TODO: 다전공 요건 확정 전까지 임시값 사용 중. 에러 반환 또는 null 처리 검토 (26. 4. 29., 정태영)
      };
    }

    return result;
  }
}
