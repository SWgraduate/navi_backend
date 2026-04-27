import { authStore } from './authStore';

export interface ChatResult {
  answer: string;
  sources?: Array<{
    documentId: string;
    fileName?: string;
    chunkId: string;
    chunkIndex: number;
    score: number;
  }>;
  retrievalMeta?: {
    topK: number;
    usedChunks: number;
  };
}

export interface ChatResponse {
  taskId: string;
  message: string;
  conversationId?: string;
}

export interface ChatStatus {
  status: "queued" | "processing" | "completed" | "failed";
  progress: string;
  displayMessage: string;
  result?: string | ChatResult;
  error?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessageItem {
  id: string;
  query: string;
  answer?: string;
  status: "queued" | "processing" | "completed" | "failed";
  createdAt: string;
}

export const startChat = async (
  query: string,
  conversationId?: string
): Promise<ChatResponse> => {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authStore.authHeaders() },
    body: JSON.stringify({ query, conversationId }),
  });
  if (!response.ok) throw new Error("Failed to start chat");
  return response.json();
};

export const getChatStatus = async (taskId: string): Promise<ChatStatus> => {
  const response = await fetch(`/api/chat/status/${taskId}`, {
    headers: { ...authStore.authHeaders() },
  });
  if (!response.ok) throw new Error("Failed to get status");
  return response.json();
};

export const createConversation = async (title?: string): Promise<{ conversationId: string }> => {
  const response = await fetch("/api/chat/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authStore.authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Failed to create conversation");
  return response.json();
};

export const listConversations = async (q?: string): Promise<ConversationSummary[]> => {
  const url = q?.trim()
    ? `/api/chat/conversations?q=${encodeURIComponent(q)}`
    : "/api/chat/conversations";

  const response = await fetch(url, {
    headers: { ...authStore.authHeaders() },
  });
  if (!response.ok) throw new Error("Failed to list conversations");
  const data = await response.json();
  return data.conversations ?? [];
};

export const renameConversation = async (conversationId: string, title: string): Promise<void> => {
  const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/title`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authStore.authHeaders() },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) throw new Error("Failed to rename conversation");
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}`, {
    method: "DELETE",
    headers: { ...authStore.authHeaders() },
  });
  if (!response.ok) throw new Error("Failed to delete conversation");
};

export const getConversationMessages = async (
  conversationId: string
): Promise<ConversationMessageItem[]> => {
  const response = await fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    headers: { ...authStore.authHeaders() },
  });
  if (!response.ok) throw new Error("Failed to get conversation messages");
  const data = await response.json();
  return data.messages ?? [];
};
