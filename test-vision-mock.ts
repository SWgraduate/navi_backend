// test-vision-mock.ts
const mockInvoke = jest.fn();
const mockWithStructuredOutput = jest.fn().mockReturnValue({
  invoke: mockInvoke,
});

jest.mock('@langchain/openai', () => {
  const ChatOpenAI = jest.fn();
  ChatOpenAI.prototype.withStructuredOutput = mockWithStructuredOutput;
  return { ChatOpenAI };
});

import { VisionService } from './src/services/VisionService';

async function runTest() {
  const service = new VisionService();
  
  mockInvoke.mockResolvedValueOnce({
    isSuccess: true,
    confidence: 100,
    reason: 'test',
  });

  const res = await service.parseGraduationRecord('testImage');
  console.log('Result:', res);
}

runTest().catch(console.error);
