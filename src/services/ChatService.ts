import { v4 as uuidv4 } from 'uuid';

export interface ChatTask {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string;
  displayMessage: string;
  result?: any;
}

export class ChatService {
  // Singleton instance
  private static instance: ChatService;
  
  // In-memory store
  private taskStore = new Map<string, ChatTask>();

  private constructor() {}

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Helper: Mock delay
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper: Mock LLM call
  private async callLLM(query: string): Promise<string> {
    await this.delay(2000);
    return `LLM 응답: ${query}`;
  }

  // Background task processor
  private async processChatTask(taskId: string, query: string) {
    const update = (progress: string, msg: string) => {
      const task = this.taskStore.get(taskId);
      if (task) {
        this.taskStore.set(taskId, { ...task, status: 'processing', progress, displayMessage: msg });
      }
    };

    try {
      // [상태 업데이트 1] 검색
      update('searching', '학교 공지사항을 검색하고 있습니다...');
      await this.delay(2000); 

      // [상태 업데이트 2] 독해
      update('reading', '찾은 문서 3건을 읽고 있습니다...');
      await this.delay(3000); 

      // [상태 업데이트 3] 생성
      update('thinking', '답변을 정리하고 있습니다...');
      const finalAnswer = await this.callLLM(query); 

      // [완료]
      this.taskStore.set(taskId, {
        status: 'completed',
        progress: 'done',
        displayMessage: '완료',
        result: finalAnswer
      });
    } catch (err) {
      this.taskStore.set(taskId, { 
        status: 'failed', 
        progress: 'error', 
        displayMessage: '오류가 발생했습니다.',
        result: err
      });
    }
  }

  public startChatTask(query: string): { taskId: string, message: string } {
    const taskId = uuidv4();
    
    // 초기 상태 저장
    this.taskStore.set(taskId, {
      status: 'queued',
      progress: 'init',
      displayMessage: '질문을 분석하고 있습니다...',
    });

    // 비동기 작업 시작 (fire-and-forget)
    this.processChatTask(taskId, query);

    return { taskId, message: 'Started' };
  }

  public getTaskStatus(taskId: string): ChatTask | undefined {
    return this.taskStore.get(taskId);
  }
}
