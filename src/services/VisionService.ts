import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { logger } from 'src/utils/log';

export class VisionService {
  private visionModel: ChatOpenAI;

  constructor() {
    this.visionModel = new ChatOpenAI({
      modelName: process.env.VISION_MODEL_NAME || 'gpt-4o',
      temperature: 0,
      configuration: {
        baseURL: process.env.CUSTOM_LLM_BASE_URL,
      },
    });
  }

  public async parseGraduationRecord(imageBase64: string) {
    logger.i('VisionService: 졸업사정표 이미지 파싱 요청 수신');

    // 💡 1. Zod를 이용한 강력한 출력 스키마 정의 (파이썬의 Pydantic 역할)
    const outputSchema = z.object({
      isSuccess: z.boolean().describe("이미지 인식 및 데이터 추출 성공 여부. 화질이 너무 낮거나 전혀 다른 이미지일 경우 false."),
      confidence: z.number().min(0).max(100).describe("추출 결과에 대한 종합 신뢰도 (0~100). 100에 가까울수록 확신함."),
      reason: z.string().describe("성공/실패에 대한 상세 이유. 예: '화질 저하로 일부 학점 숫자 식별 불가', '정상적인 졸업사정조회 표로 확인됨'"),

      // 데이터 부분 (실패했을 수도 있으므로 optional 처리)
      graduationRule: z.object({
        totalCredits: z.number().optional(),
        majorCore: z.number().optional(),
        majorAdvanced: z.number().optional(),
        generalElective: z.number().optional()
      }).optional().describe("추출된 졸업 요건(기준) 학점 데이터"),

      academicRecord: z.object({
        totalCredits: z.number().optional(),
        majorCore: z.number().optional(),
        majorAdvanced: z.number().optional(),
        generalElective: z.number().optional()
      }).optional().describe("추출된 학생의 실제 이수(취득) 학점 데이터")
    });

    // 💡 2. 파이썬의 structured_llm과 동일한 메서드 적용
    const structuredLlm = this.visionModel.withStructuredOutput(outputSchema, {
      name: "graduation_record_extractor" // LLM에게 이 함수의 목적을 알려줌
    });

    // 3. 프롬프트 (스키마를 Zod가 알아서 주입하므로 프롬프트가 훨씬 깔끔해짐)
    const systemPrompt = `
      너는 대학교 학적 시스템의 졸업사정조회 표를 분석하는 데이터 추출 AI야.
      주어진 이미지를 분석하여 사용자의 '졸업 요건(Rule)'과 '현재 이수 내역(Record)'을 추출해.
      만약 화질이 너무 낮아서 숫자를 도저히 읽을 수 없거나, 표가 아닌 엉뚱한 이미지라면 isSuccess를 false로 두고 reason에 명확한 이유를 적어줘.
    `;

    const messages = [
      new SystemMessage(systemPrompt),
      new HumanMessage({
        content: [
          { type: 'text', text: '이 이미지를 분석해서 명세된 스키마에 맞춰 반환해줘.' },
          {
            type: 'image_url',
            image_url: {
              url: imageBase64.startsWith('data:image')
                ? imageBase64
                : `data:image/jpeg;base64,${imageBase64}`,
            },
          },
        ],
      }),
    ];

    try {
      // 💡 4. 실행 (반환값 result는 Zod 스키마에 맞춰 완벽하게 타입이 추론됨!)
      const result = await structuredLlm.invoke(messages);

      if (!result.isSuccess) {
        logger.w(`VisionService: 인식 실패 또는 반려됨 (이유: ${result.reason})`);
      } else {
        logger.i(`VisionService: 파싱 성공 (신뢰도: ${result.confidence}%)`);
      }

      return result;

    } catch (error) {
      logger.e('VisionService: 통신 또는 파싱 시스템 에러', error);
      throw new Error('이미지를 분석하는 과정에서 시스템 오류가 발생했습니다.');
    }
  }
}