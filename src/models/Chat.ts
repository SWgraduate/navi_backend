import mongoose, { Document, Schema } from 'mongoose';

export interface IChat extends Document {
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: string; // e.g. 'searching', 'reading', 'thinking', 'done'
  displayMessage: string;
  query: string;
  answer?: string; // The final LLM response
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

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
