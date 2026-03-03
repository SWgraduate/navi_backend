import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import ChatModel, { IChat } from '@/models/Chat';
import mongoose from 'mongoose';

export interface ChatTask {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string;
  displayMessage: string;
  result?: any;
}

export class ChatService {
  // Singleton instance
  private static instance: ChatService;

  // Fallback in-memory store
  private inMemoryStore = new Map<string, any>();

  private constructor() { }

  public static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  // Helper: Check if DB is ready
  private isDbReady(): boolean {
    return mongoose.connection.readyState === 1;
  }

  // Helper: Mock delay
  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Helper: Real LLM call using LangChain
  private async callLLM(query: string): Promise<string> {
    // API key 확인
    const apiKey = process.env.LLM_TOKEN || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.warn("API Key not found.");
    }

    try {
      const chat = new ChatOpenAI({
        apiKey: apiKey,
        modelName: "xiaomi/mimo-v2-flash:free", // NOTE: The free MiMo-V2-Flash period has ended. To continue using this model, please migrate to the paid slug: xiaomi/mimo-v2-flash (26. 2. 9. 정태영)
        temperature: 0.7,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1"
        }
      });

      const response = await chat.invoke([
        new HumanMessage(query),
      ]);

      return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    } catch (error) {
      console.error("LangChain Error:", error);
      throw error;
    }
  }

  // Background task processor
  private async processChatTask(taskId: string, query: string) {
    const update = async (progress: string, msg: string, finalAnswer?: string) => {
      const updateData: any = {
        status: progress === 'done' ? 'completed' : 'processing',
        progress,
        displayMessage: msg
      };
      if (finalAnswer) updateData.answer = finalAnswer;

      if (this.isDbReady()) {
        await ChatModel.findByIdAndUpdate(taskId, updateData);
      } else {
        const existing = this.inMemoryStore.get(taskId);
        this.inMemoryStore.set(taskId, { ...existing, ...updateData });
      }
    };

    try {
      // [Step 1] Searching (Simulated)
      // await update('searching', 'searching school notices...');
      // await this.delay(2000);

      // [Step 2] Reading (Simulated)
      // await update('reading', 'Reading 3 retrieved documents...');
      // await this.delay(3000);

      // [Step 3] Thinking (Real LLM)
      await update('thinking', '분석중...');
      const finalAnswer = await this.callLLM(query);

      // [Completed]
      await update('done', 'Completed', finalAnswer);

    } catch (err: any) {
      console.error(`Task ${taskId} failed:`, err);
      const errorData = {
        status: 'failed',
        progress: 'error',
        displayMessage: 'An error occurred.',
        error: err.message || String(err)
      };

      if (this.isDbReady()) {
        await ChatModel.findByIdAndUpdate(taskId, errorData);
      } else {
        const existing = this.inMemoryStore.get(taskId);
        this.inMemoryStore.set(taskId, { ...existing, ...errorData });
      }
    }
  }

  public async startChatTask(query: string): Promise<{ taskId: string, message: string }> {
    let taskId: string;

    if (this.isDbReady()) {
      // Create initial record in MongoDB
      const chat = await ChatModel.create({
        query,
        status: 'queued',
        progress: 'init',
        displayMessage: 'Analyzing question...',
      });
      taskId = chat._id.toString();
    } else {
      // Fallback: Create in-memory record
      taskId = Date.now().toString(); // Simple ID
      this.inMemoryStore.set(taskId, {
        _id: taskId,
        query,
        status: 'queued',
        progress: 'init',
        displayMessage: 'Analyzing question...',
      });
      console.warn(`[ChatService] MongoDB not ready. Using in-memory store for task ${taskId}`);
    }

    // Start background process (fire-and-forget)
    this.processChatTask(taskId, query);

    return { taskId, message: 'Started' };
  }

  public async getTaskStatus(taskId: string): Promise<ChatTask | undefined> {
    let chat: any;

    if (this.isDbReady()) {
      chat = await ChatModel.findById(taskId);
    } else {
      chat = this.inMemoryStore.get(taskId);
    }

    if (!chat) return undefined;

    return {
      status: chat.status,
      progress: chat.progress,
      displayMessage: chat.displayMessage,
      result: chat.answer
    };
  }
}
