import { VisionService } from 'src/services/VisionService';
import { ChatOpenAI } from '@langchain/openai';

// logger 모킹
jest.mock('src/utils/log', () => ({
  logger: {
    i: jest.fn(),
    w: jest.fn(),
    e: jest.fn(),
  },
}));

// ChatOpenAI 자동 모킹
jest.mock('@langchain/openai');

const mockInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn();

describe('VisionService Test', () => {
  let visionService: VisionService;

  beforeEach(() => {
    // jest.config.js의 resetMocks: true 설정으로 인해 매 테스트마다 mock이 초기화됨.
    // → mockReturnValue 등 구현체를 beforeEach 안에서 재설정해야 함.
    mockWithStructuredOutput.mockReturnValue({ invoke: mockInvoke });

    // jest.mocked()를 사용하여 타입 안전하게 자동 모킹된 클래스에 mockImplementation 적용
    jest.mocked(ChatOpenAI).mockImplementation((): any => ({
      withStructuredOutput: mockWithStructuredOutput,
    }));

    visionService = new VisionService();
  });

  describe('parseGraduationRecord', () => {
    it('should successfully parse graduation record and return success data', async () => {
      // LLM이 반환해야 할 정상 결과 모킹
      const mockSuccessResult = {
        isSuccess: true,
        confidence: 95,
        reason: '정상적인 졸업사정조회 표로 확인됨',
        graduationRule: {
          totalCredits: 130,
          majorCore: 33,
          majorAdvanced: 42,
          generalElective: 55,
        },
        academicRecord: {
          totalCredits: 100,
          majorCore: 24,
          majorAdvanced: 30,
          generalElective: 46,
        },
      };

      mockInvoke.mockResolvedValueOnce(mockSuccessResult);

      const fakeImageBase64 = 'fakeBase64StringForTesting';
      const result = await visionService.parseGraduationRecord(fakeImageBase64);

      // 반환된 객체가 예상된 스키마에 맞는지 검증
      expect(result).toMatchObject(mockSuccessResult);
      expect(result.isSuccess).toBe(true);

      // invoke가 1회 실행되었는지 확인
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      // 시스템 프롬프트 등 인자 길이나 대략적인 구조가 전달되었는지 확인 (첫 번째 인자가 messages 배열)
      expect(mockInvoke.mock.calls[0][0]).toBeInstanceOf(Array);
      expect(mockInvoke.mock.calls[0][0].length).toBe(2); // SystemMessage, HumanMessage
    });

    it('should handle rejection due to poor image quality or invalid image', async () => {
      // LLM이 반환해야 할 실패(반려) 결과 모킹
      const mockRejectionResult = {
        isSuccess: false,
        confidence: 40,
        reason: '화질 저하로 일부 학점 숫자 식별 불가',
      };

      mockInvoke.mockResolvedValueOnce(mockRejectionResult);

      const fakeImageBase64 = 'fakeBase64StringForTesting';
      const result = await visionService.parseGraduationRecord(fakeImageBase64);

      expect(result.isSuccess).toBe(false);
      expect(result.reason).toBe(mockRejectionResult.reason);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should throw an error when unstructured system error occurs', async () => {
      // 통신 중단 또는 에러 상황 모킹
      mockInvoke.mockRejectedValueOnce(new Error('네트워크 연결 오류 발생'));

      const fakeImageBase64 = 'fakeBase64StringForTesting';
      
      await expect(visionService.parseGraduationRecord(fakeImageBase64))
        .rejects
        .toThrow('이미지를 분석하는 과정에서 시스템 오류가 발생했습니다.');

      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });
  });
});
