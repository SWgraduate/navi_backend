import Major from 'src/models/Major';
import { Controller, Get, Query, Response, Route, Tags } from 'tsoa';
import { logger } from 'src/utils/log';
import { GraduationService, GraduationRequirements } from 'src/services/GraduationService';

export interface MajorListResponse {
  /** 전공 목록 (단과대학 → 전공명 배열 구조) */
  [college: string]: string[];
}

@Route('majors')
@Tags('Major')
export class MajorController extends Controller {
  /**
   * 유효한 전공 목록 전체를 단과대학별로 그룹핑하여 반환합니다.
   * 프론트엔드 드롭다운 항목 구성에 사용됩니다. (인증 불필요)
   *
   * @param college 특정 단과대학만 조회하려면 이름을 전달 (미전달 시 전체 반환)
   */
  @Get('/')
  @Response<{ error: string }>(500, 'Internal Server Error')
  public async listMajors(
    @Query() college?: string
  ): Promise<MajorListResponse | { error: string }> {
    try {
      const filter = college ? { college } : {};
      const majors = await Major.find(filter).select('college name -_id').lean();

      // { college: string[] } 형태로 그룹핑
      const grouped: MajorListResponse = {};
      for (const major of majors) {
        if (!grouped[major.college]) {
          grouped[major.college] = [];
        }
        grouped[major.college]!.push(major.name);
      }

      return grouped;
    } catch (e: any) {
      logger.e('MajorController.listMajors: 전공 목록 조회 실패', e);
      this.setStatus(500);
      return { error: '전공 목록을 불러오는 데 실패했습니다.' };
    }
  }

  /**
   * 선택된 학과, 입학년도, 편입 여부에 따른 졸업 이수 기준 학점을 반환합니다.
   * 사용자의 특수한 학적 상태(편입, 다중전공)에 대응하여 고정되지 않은(Flexible) 렌더링을 지원하기 위함입니다.
   *
   * @param major 소속 학과명 (예: 컴퓨터학부, 융합시스템공학과)
   * @param admissionYear 입학년도 (예: 2024, 2023)
   * @param isTransfer 편입생 여부 (true 시 3학년 편입 기준 적용)
   * @param secondMajorType 제2전공 종류 (다중전공, 복수전공 등 - 선택)
   */
  @Get('/graduation-requirements')
  @Response<{ error: string }>(400, 'Bad Request')
  @Response<{ error: string }>(500, 'Internal Server Error')
  public async getGraduationRequirements(
    @Query() major: string,
    @Query() admissionYear: number,
    @Query() isTransfer: boolean = false,
    @Query() secondMajorType?: string
  ): Promise<GraduationRequirements | { error: string }> {
    try {
      if (!major) {
        this.setStatus(400);
        return { error: '전공(major) 정보가 필요합니다.' };
      }

      const requirements = GraduationService.calculateRequirements({
        major,
        admissionYear,
        isTransfer,
        secondMajorType: secondMajorType || null,
      });

      return requirements;
    } catch (e: any) {
      logger.e('MajorController.getGraduationRequirements: 졸업 요건 조회 실패', e);
      this.setStatus(500);
      return { error: '졸업 요건을 분석할 수 없습니다.' };
    }
  }
}
