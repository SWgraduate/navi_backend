import { authStore } from './authStore';

export interface UploadPdfResponse {
  documentId: string;
  status: string;
  message: string;
  isDuplicate: boolean;
  chunkCount: number;
}

export const uploadPdf = async (params: {
  file: File;
  userId: string;
  role?: "user" | "admin";
}): Promise<UploadPdfResponse> => {
  const formData = new FormData();
  formData.append("file", params.file);
  formData.append("userId", params.userId);
  formData.append("role", params.role ?? "user");

  const response = await fetch("/api/rag/documents/upload", {
    method: "POST",
    headers: { ...authStore.authHeaders() },
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to upload PDF");
  }

  return response.json();
};
