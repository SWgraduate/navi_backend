export interface ChatResponse {
    taskId: string;
    message: string;
}

export interface ChatStatus {
    status: 'queued' | 'processing' | 'completed' | 'failed';
    progress: string;
    displayMessage: string;
    result?: string;
    error?: string;
}

export const startChat = async (query: string): Promise<ChatResponse> => {
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
    });
    if (!response.ok) throw new Error('Failed to start chat');
    return response.json();
};

export const getChatStatus = async (taskId: string): Promise<ChatStatus> => {
    const response = await fetch(`/api/chat/status/${taskId}`);
    if (!response.ok) throw new Error('Failed to get status');
    return response.json();
};
