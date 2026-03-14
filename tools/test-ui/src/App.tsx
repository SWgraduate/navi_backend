import { useState } from 'react'
import { ChatLayout, type AppScreen } from './components/Chat/ChatLayout'
import { MessageList } from './components/Chat/MessageList'
import { MessageInput } from './components/Chat/MessageInput'
import { UploadPanel } from './components/Upload/UploadPanel'
import type { Message } from './types/chat'
import { startChat, getChatStatus } from './api/chatApi'

function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '정태영님의 한양대 생활을 더 편하게, 무엇이든 물어보세요'
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeScreen, setActiveScreen] = useState<AppScreen>('chat');

  const pollStatus = async (taskId: string) => {
    const interval = setInterval(async () => {
      try {
        const status = await getChatStatus(taskId);

        // Update the last message (assistant placeholder) with status
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.role === 'assistant') {
            // Show progress message if not done, or final result
            if (status.status === 'completed' && status.result) {
              if (typeof status.result === "string") {
                lastMsg.content = status.result;
              } else {
                lastMsg.content = status.result.answer;
              }
            } else if (status.status === "failed") {
              lastMsg.content = `Error: ${status.error || status.displayMessage || "Unknown error"}`;
            } else {
              lastMsg.content = `${status.displayMessage} (${status.progress})`;
            }
          }
          return newMessages;
        });

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(interval);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Polling error", error);
        clearInterval(interval);
        setIsLoading(false);
      }
    }, 1000);
  };

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Add placeholder assistant message
      const placeholderId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: placeholderId,
        role: 'assistant',
        content: '분석중...'
      }]);

      const { taskId } = await startChat(content);
      pollStatus(taskId);
    } catch (error) {
      console.error("Failed to start chat", error);
      setIsLoading(false);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '메시지를 생성하는 중 문제가 발생하였습니다.'
      }]);
    }
  };

  return (
    <ChatLayout activeScreen={activeScreen} onScreenChange={setActiveScreen}>
      {activeScreen === 'upload' ? (
        <UploadPanel />
      ) : (
        <>
          <MessageList messages={messages} />
          <MessageInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </>
      )}
    </ChatLayout>
  )
}

export default App
