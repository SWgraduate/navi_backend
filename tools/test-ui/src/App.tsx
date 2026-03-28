import { useEffect, useState } from 'react'
import { ChatLayout, type AppScreen } from './components/Chat/ChatLayout'
import { MessageList } from './components/Chat/MessageList'
import { MessageInput } from './components/Chat/MessageInput'
import { UploadPanel } from './components/Upload/UploadPanel'
import { VoicePanel } from './components/Voice/VoicePanel'
import type { Message } from './types/chat'
import {
  createConversation,
  getChatStatus,
  getConversationMessages,
  listConversations,
  startChat,
  type ConversationMessageItem,
  type ConversationSummary,
} from './api/chatApi'

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
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>(undefined);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const mapConversationMessages = (items: ConversationMessageItem[]): Message[] => {
    const mapped: Message[] = [];

    for (const item of items) {
      mapped.push({
        id: `${item.id}-q`,
        role: 'user',
        content: item.query,
      });

      if (item.answer) {
        mapped.push({
          id: `${item.id}-a`,
          role: 'assistant',
          content: item.answer,
        });
      }
    }

    return mapped.length > 0
      ? mapped
      : [{
        id: 'empty-conversation',
        role: 'assistant',
        content: '아직 대화가 없습니다. 질문을 시작해보세요.',
      }];
  };

  const refreshConversations = async (q?: string) => {
    try {
      const rows = await listConversations(q);
      setConversations(rows);
    } catch (error) {
      console.error('Failed to load conversations', error);
    }
  };

  useEffect(() => {
    refreshConversations();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshConversations(searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleNewChat = async () => {
    try {
      const created = await createConversation();
      setActiveConversationId(created.conversationId);
      setMessages([
        {
          id: `new-${Date.now()}`,
          role: 'assistant',
          content: '새 대화를 시작합니다. 무엇이든 물어보세요',
        },
      ]);
      setActiveScreen('chat');
      refreshConversations(searchQuery);
    } catch (error) {
      console.error('Failed to create conversation', error);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    try {
      const rows = await getConversationMessages(conversationId);
      setActiveConversationId(conversationId);
      setMessages(mapConversationMessages(rows));
      setActiveScreen('chat');
    } catch (error) {
      console.error('Failed to load conversation messages', error);
    }
  };

  const pollStatus = async (taskId: string, resolvedConversationId?: string) => {
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
          if (resolvedConversationId) {
            setActiveConversationId(resolvedConversationId);
          }
          refreshConversations(searchQuery);
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

      const { taskId, conversationId } = await startChat(content, activeConversationId);
      const resolvedConversationId = conversationId ?? activeConversationId;

      if (!activeConversationId && conversationId) {
        setActiveConversationId(conversationId);
      }

      pollStatus(taskId, resolvedConversationId);
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
    <ChatLayout
      activeScreen={activeScreen}
      onScreenChange={setActiveScreen}
      conversations={conversations}
      activeConversationId={activeConversationId}
      onNewChat={handleNewChat}
      onSelectConversation={handleSelectConversation}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
    >
      {activeScreen === 'upload' ? (
        <UploadPanel />
      ) : activeScreen === 'voice' ? (
        <VoicePanel />
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
