import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

// TODO: 유틸 함수 종합 필요
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// TODO: 임시 저장소, 리팩토링 필요
const taskStore = new Map<string, {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string;
  displayMessage: string;
  result?: any;
}>();

// 임시 LLM 호출 함수
async function callLLM(query: string): Promise<string> {
  // 실제 LLM API 호출 로직이 여기에 들어감
  await delay(2000);
  return `LLM 응답: ${query}`;
}

// 실제 로직 함수 (오래 걸리는 작업)
async function processChatTask(taskId: string, query: string) {
  const update = (progress: string, msg: string) => {
    const task = taskStore.get(taskId);
    if (task) taskStore.set(taskId, { ...task, status: 'processing', progress, displayMessage: msg });
  };

  try {
    // [상태 업데이트 1] 검색
    update('searching', '학교 공지사항을 검색하고 있습니다...');
    await delay(2000); // 검색 시늉

    // [상태 업데이트 2] 독해
    update('reading', '찾은 문서 3건을 읽고 있습니다...');
    await delay(3000); // 독해 시늉

    // [상태 업데이트 3] 생성
    update('thinking', '답변을 정리하고 있습니다...');
    const finalAnswer = await callLLM(query); // 실제 LLM 호출

    // [완료]
    taskStore.set(taskId, {
      status: 'completed',
      progress: 'done',
      displayMessage: '완료',
      result: finalAnswer
    });
  } catch (err) {
    taskStore.set(taskId, { status: 'failed', progress: 'error', displayMessage: '오류가 발생했습니다.' });
  }
}

const router = Router();

router.post('/', (req, res) => {
  const { query } = req.body;
  const taskId = uuidv4();

  // 1. 초기 상태 저장
  taskStore.set(taskId, {
    status: 'queued',
    progress: 'init',
    displayMessage: '질문을 분석하고 있습니다...',
  });

  // 2. 비동기로 작업 시작 (await 안 씀!)
  processChatTask(taskId, query); 

  // 3. 즉시 응답 반환
  res.status(202).json({ taskId, message: 'Started' });
});

router.get('/status/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = taskStore.get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(task);
});

export default router;
