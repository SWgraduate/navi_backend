import { Request as ExRequest } from 'express';
import { AcademicRecordNotFoundError, ImageParsingError, StudentNotFoundError } from 'src/errors/StudentErrors';
import { optimizeBase64Image } from 'src/utils/imageExt';
import {
  AcademicRecordResponse,
  ParseAndUpdateResponse,
  ParseTimetableResponse,
  StudentResponse,
  StudentService,
  UpdateAcademicRecordRequest,
  UpsertProfileRequest,
} from 'src/services/StudentService';
import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from 'tsoa';

export interface ParseImageRequest {
  /** Base64 인코딩된 졸업사정표 이미지 문자열 */
  imageBase64: string;
}

@Route('student')
@Tags('Student')
export class StudentController extends Controller {
  private studentService = new StudentService();

  /**
   * 학적 기본정보 등록/수정
   * 최초 등록 시에도, 이후 수정 시에도 동일 엔드포인트(upsert) 사용.
   */
  @Post('me/profile')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(400, 'Bad Request')
  public async upsertProfile(
    @Body() body: UpsertProfileRequest,
    @Request() req: ExRequest
  ): Promise<StudentResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    try {
      const result = await this.studentService.upsertProfile(userId, body);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        this.setStatus(400);
        return { error: error.message || '잘못된 학적 정보입니다.' };
      }
      this.setStatus(500);
      return { error: '학적 정보 등록/수정 중 서버 오류가 발생했습니다.' };
    }
  }

  /**
   * 학적 기본정보 조회
   */
  @Get('me/profile')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(404, 'Not Found')
  public async getProfile(
    @Request() req: ExRequest
  ): Promise<StudentResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    try {
      const result = await this.studentService.getProfile(userId);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error instanceof StudentNotFoundError) {
        this.setStatus(404);
        return { error: error.message };
      } else {
        this.setStatus(500);
        return { error: '학적 정보 조회 중 서버 오류가 발생했습니다.' };
      }
    }
  }

  /**
   * 이수 현황 조회
   */
  @Get('me/academic-record')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(404, 'Not Found')
  public async getAcademicRecord(
    @Request() req: ExRequest
  ): Promise<AcademicRecordResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    try {
      const result = await this.studentService.getAcademicRecord(userId);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error instanceof StudentNotFoundError || error instanceof AcademicRecordNotFoundError) {
        this.setStatus(404);
        return { error: error.message };
      } else {
        this.setStatus(500);
        return { error: '이수 현황 조회 중 서버 오류가 발생했습니다.' };
      }
    }
  }

  /**
   * 이수 현황 직접 수정
   * 학점 및 조건 항목을 부분 업데이트함. takenCourses를 전달하면 전체 목록을 교체함.
   */
  @Put('me/academic-record')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(400, 'Bad Request')
  public async updateAcademicRecord(
    @Body() body: UpdateAcademicRecordRequest,
    @Request() req: ExRequest
  ): Promise<AcademicRecordResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    try {
      const result = await this.studentService.updateAcademicRecord(userId, body);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error.name === 'ValidationError') {
        this.setStatus(400);
        return { error: error.message || '잘못된 이수 현황 정보입니다.' };
      } else if (error instanceof StudentNotFoundError) {
        this.setStatus(404);
        return { error: error.message };
      }
      this.setStatus(500);
      return { error: '이수 현황 수정 중 서버 오류가 발생했습니다.' };
    }
  }

  /**
   * 졸업사정표 이미지 파싱 후 이수 현황 자동 업데이트
   * Base64 인코딩된 이미지를 수신하여 VisionService로 분석 후 AcademicRecord를 갱신함.
   */
  @Post('me/academic-record/parse')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(400, 'Bad Request')
  @Response<{ error: string }>(422, 'Unprocessable Content')
  public async parseAndUpdateFromImage(
    @Body() body: ParseImageRequest,
    @Request() req: ExRequest
  ): Promise<ParseAndUpdateResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    if (!body.imageBase64) {
      this.setStatus(400);
      return { error: 'imageBase64 필드가 필요합니다.' };
    }

    try {
      const optimizedBase64 = await optimizeBase64Image(body.imageBase64);
      const result = await this.studentService.parseAndUpdateFromImage(userId, optimizedBase64);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error instanceof StudentNotFoundError) {
        this.setStatus(404);
        return { error: error.message };
      } else if (error instanceof ImageParsingError) {
        this.setStatus(422);
        return { error: error.message };
      } else if (error.name === 'ValidationError') {
        this.setStatus(400);
        return { error: error.message || '잘못된 이수 현황 정보입니다.' };
      } else {
        this.setStatus(500);
        return { error: '이미지 파싱 및 이수 현황 업데이트 중 서버 오류가 발생했습니다.' };
      }
    }
  }

  /**
   * 시간표 이미지 파싱 후 이수 현황 및 수강 목록 자동 업데이트
   * 
   * Base64 형태의 시간표 이미지를 수신하여 VisionService로 각 과목과 시간을 추출합니다.
   * 추출된 과목명과 시간을 바탕으로 시스템의 전체 과목 DB(Course 모델)와 매핑한 후, 
   * 사용자의 수강 목록(takenCourses)에 중복을 제외하고 추가합니다.
   * 또한 새롭게 추가된 과목의 이수 구분과 학점을 분석하여, 졸업학점, 전공학점, 
   * 교양학점, 영어전용/IC-PBL 강좌 수 등 AcademicRecord의 세부 영역 수치도 함께 자동으로 갱신(증가)시킵니다.
   */
  @Post('me/academic-record/parse-timetable')
  @Security('jwt')
  @SuccessResponse('200', 'OK')
  @Response<{ error: string }>(401, 'Unauthorized')
  @Response<{ error: string }>(400, 'Bad Request')
  @Response<{ error: string }>(422, 'Unprocessable Content')
  public async parseTimetableAndUpdate(
    @Body() body: ParseImageRequest,
    @Request() req: ExRequest
  ): Promise<ParseAndUpdateResponse | { error: string }> {
    const userId = req.user;

    if (!userId) {
      this.setStatus(401);
      return { error: 'Unauthorized' };
    }

    if (!body.imageBase64) {
      this.setStatus(400);
      return { error: 'imageBase64 필드가 필요합니다.' };
    }

    try {
      const optimizedBase64 = await optimizeBase64Image(body.imageBase64);
      const result = await this.studentService.parseTimetableAndUpdate(userId, optimizedBase64);
      this.setStatus(200);
      return result;
    } catch (error: any) {
      if (error instanceof StudentNotFoundError) {
        this.setStatus(404);
        return { error: error.message };
      } else if (error instanceof ImageParsingError) {
        this.setStatus(422);
        return { error: error.message };
      } else {
        this.setStatus(500);
        return { error: '시간표 이미지 파싱 중 서버 오류가 발생했습니다.' };
      }
    }
  }
}
