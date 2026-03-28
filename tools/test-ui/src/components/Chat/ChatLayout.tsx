import React from 'react';
import type { ConversationSummary } from '../../api/chatApi';

export type AppScreen = 'chat' | 'upload' | 'voice';

interface ChatLayoutProps {
    children: React.ReactNode;
    activeScreen: AppScreen;
    onScreenChange: (screen: AppScreen) => void;
    conversations: ConversationSummary[];
    activeConversationId?: string;
    onNewChat: () => void;
    onSelectConversation: (conversationId: string) => void;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
}

const formatDate = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
    ).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(
        date.getMinutes()
    ).padStart(2, '0')}`;
};

export const ChatLayout: React.FC<ChatLayoutProps> = ({
    children,
    activeScreen,
    onScreenChange,
    conversations,
    activeConversationId,
    onNewChat,
    onSelectConversation,
    searchQuery,
    onSearchQueryChange,
}) => {
    const navButtonStyle = (screen: AppScreen): React.CSSProperties => ({
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        padding: '10px',
        background: activeScreen === screen ? 'var(--input-bg)' : 'transparent',
        color: '#fff',
        cursor: 'pointer',
        textAlign: 'left',
        marginBottom: '8px',
        transition: 'background 0.2s',
    });

    return (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <aside style={{
                width: '260px',
                backgroundColor: 'var(--sidebar-bg)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                color: '#fff'
            }}>
                <button
                    onClick={onNewChat}
                    style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '5px',
                    padding: '10px',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '20px',
                    transition: 'background 0.2s',
                }}>
                    + New chat
                </button>

                <button
                    onClick={() => onScreenChange('chat')}
                    style={navButtonStyle('chat')}
                >
                    Chat
                </button>

                <button
                    onClick={() => onScreenChange('upload')}
                    style={navButtonStyle('upload')}
                >
                    Upload
                </button>

                <button
                    onClick={() => onScreenChange('voice')}
                    style={navButtonStyle('voice')}
                >
                    🎙️ Voice Test
                </button>

                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ padding: '10px 10px 6px', color: '#8e8ea0', fontSize: '0.9rem' }}>
                        Chat History
                    </div>

                    <input
                        value={searchQuery}
                        onChange={(e) => onSearchQueryChange(e.target.value)}
                        placeholder="Search conversation..."
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            background: 'var(--input-bg)',
                            color: '#fff',
                            outline: 'none',
                            marginBottom: '10px',
                        }}
                    />

                    {conversations.length === 0 ? (
                        <div style={{ color: '#8e8ea0', fontSize: '0.85rem', padding: '8px 4px' }}>
                            No conversations yet
                        </div>
                    ) : (
                        conversations.map((conversation) => {
                            const isActive = conversation.id === activeConversationId;

                            return (
                                <button
                                    key={conversation.id}
                                    onClick={() => onSelectConversation(conversation.id)}
                                    style={{
                                        width: '100%',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        padding: '10px',
                                        marginBottom: '8px',
                                        background: isActive ? 'var(--input-bg)' : 'transparent',
                                        color: '#fff',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                    }}
                                >
                                    <div
                                        style={{
                                            fontSize: '0.9rem',
                                            fontWeight: 600,
                                            marginBottom: '6px',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}
                                    >
                                        {conversation.title}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#8e8ea0' }}>
                                        {formatDate(conversation.lastMessageAt)}
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </aside>

            <main style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                backgroundColor: 'var(--bg-color)'
            }}>
                {children}
            </main>
        </div>
    );
};
