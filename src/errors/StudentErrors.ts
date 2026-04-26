/**
 * Student 도메인 관련 커스텀 에러 클래스 모음
 */

export class StudentNotFoundError extends Error {
  constructor(message = '학적 정보가 존재하지 않습니다. 먼저 학적 기본정보를 등록해주세요.') {
    super(message);
    this.name = 'StudentNotFoundError';
  }
}

export class ImageParsingError extends Error {
  constructor(message = '이미지 파싱 및 이수 현황 추출에 실패했습니다.') {
    super(message);
    this.name = 'ImageParsingError';
  }
}

export class AcademicRecordNotFoundError extends Error {
  constructor(message = '이수 현황 정보가 존재하지 않습니다.') {
    super(message);
    this.name = 'AcademicRecordNotFoundError';
  }
}

export class InvalidMajorError extends Error {
  constructor(majorName: string) {
    super(`유효하지 않은 전공입니다: ${majorName}`);
    this.name = 'ValidateError';
  }
}
