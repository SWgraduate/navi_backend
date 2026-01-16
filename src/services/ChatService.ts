import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import ChatModel, { IChat } from '../models/Chat';

export interface ChatTask {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string;
  displayMessage: string;
  result?: any;
}

export class ChatService {
  // Singleton instance
  private static instance: ChatService;

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

  // Helper: Real LLM call using LangChain
  private async callLLM(query: string): Promise<string> {
    // 1. Try to load API Key from LLM_TOKEN (user preference) or OPENAI_API_KEY (fallback)
    const apiKey = process.env.LLM_TOKEN || process.env.OPENAI_API_KEY;

    // Debug log to check if key is loaded (prints only first 4 chars for security)
    if (apiKey) {
      console.log(`[ChatService] API Key loaded: ${apiKey.substring(0, 4)}...`);
    } else {
      console.warn("[ChatService] API Key is MISSING (LLM_TOKEN or OPENAI_API_KEY).");
    }

    if (!apiKey) {
      console.warn("API Key not found. Using mock response.");
      await this.delay(2000);
      return `[Mock] LLM Response: ${query} (Please set LLM_TOKEN in .env)`;
    }

    try {
      const chat = new ChatOpenAI({
        apiKey: apiKey,
        modelName: "google/gemini-3-flash-preview", 
        temperature: 0.7,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
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
    const update = async (progress: string, msg: string) => {
      await ChatModel.findByIdAndUpdate(taskId, {
        status: 'processing',
        progress,
        displayMessage: msg
      });
    };

    try {
      // [Step 1] Searching (Simulated)
      await update('searching', 'Searching school notices...');
      await this.delay(2000); 

      // [Step 2] Reading (Simulated)
      await update('reading', 'Reading 3 retrieved documents...');
      await this.delay(3000); 

      // [Step 3] Thinking (Real LLM)
      await update('thinking', 'Generatng answer...');
      const finalAnswer = await this.callLLM(query); 

      // [Completed]
      await ChatModel.findByIdAndUpdate(taskId, {
        status: 'completed',
        progress: 'done',
        displayMessage: 'Completed',
        answer: finalAnswer
      });

    } catch (err: any) {
      console.error(`Task ${taskId} failed:`, err);
      await ChatModel.findByIdAndUpdate(taskId, {
        status: 'failed',
        progress: 'error',
        displayMessage: 'An error occurred.',
        error: err.message || String(err)
      });
    }
  }

  public async startChatTask(query: string): Promise<{ taskId: string, message: string }> {
    // Create initial record in MongoDB
    const chat = await ChatModel.create({
      query,
      status: 'queued',
      progress: 'init',
      displayMessage: 'Analyzing question...',
    });

    const taskId = chat._id.toString();

    // Start background process (fire-and-forget)
    this.processChatTask(taskId, query);

    return { taskId, message: 'Started' };
  }

  public async getTaskStatus(taskId: string): Promise<ChatTask | undefined> {
    const chat = await ChatModel.findById(taskId);
    if (!chat) return undefined;

    return {
      status: chat.status,
      progress: chat.progress,
      displayMessage: chat.displayMessage,
      result: chat.answer // Map 'answer' to 'result' for consistency with interface
    };
  }
}
