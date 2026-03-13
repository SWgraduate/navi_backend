import { LargeNumberLike } from 'crypto';
import mongoose, { Document, Schema } from 'mongoose';

export interface IChatSource {
  documentId: string;
  fileName?: string;
  chunkId: string;
  chunkIndex: number;
  score: number;
}

export interface IChatRetrievalMeta {
  topK: number;
  usedChunks: number;
}

export interface IChatResult { 
  answer: string;
  sources: IChatSource[];
  retrievalMeta: IChatRetrievalMeta;
}

export interface IChat extends Document {
  status: "queued" | "processing" | "completed" | "failed";
  progress: string;
  displayMessage: string;
  query: string;
  answer?: string;
  error?: string;
  result?: IChatResult;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSourceSchema = new Schema<IChatSource>({
  documentId: { type: String, required: true },
  fileName: { type: String },
  chunkId: { type: String, required: true },
  chunkIndex: { type: Number, required: true },
  score: { type: Number, required: true },
  },
  { _id: false }
);

const ChatRetrievalMetaSchema = new Schema<IChatRetrievalMeta>(
  {
    topK: { type: Number, required: true },
    usedChunks: { type: Number, required: true },
  }
)

const ChatResultSchema = new Schema<IChatResult>(
  {
    answer: { type: String, required: true },
    sources: { type: [ChatSourceSchema], default: [ ]},
    retrievalMeta: { type: ChatRetrievalMetaSchema, required: true},
  },
  { _id: false }
);

const ChatSchema: Schema = new Schema(
  {
    status: { 
      type: String, 
      enum: ['queued', 'processing', 'completed', 'failed'], 
      default: 'queued' 
    },
    progress: { type: String, default: 'init' },
    displayMessage: { type: String, default: 'Initializing...' },
    query: { type: String, required: true },
    answer: { type: String },
    error: { type: String }
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IChat>('Chat', ChatSchema);
