import Major from 'src/models/Major';
import { Controller, Get, Query, Response, Route, Tags } from 'tsoa';
import { logger } from 'src/utils/log';

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
}
