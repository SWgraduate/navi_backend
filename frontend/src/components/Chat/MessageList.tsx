import React, { useRef, useEffect } from 'react';
import type { Message } from '../../types/chat';

interface MessageListProps {
    messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: '150px' // Space for input
        }}>
            {messages.map((msg) => (
                <div key={msg.id} style={{
                    backgroundColor: msg.role === 'assistant' ? 'var(--ai-msg-bg)' : 'transparent',
                    borderBottom: '1px solid rgba(0,0,0,0.1)',
                    padding: '24px 0'
                }}>
                    <div style={{
                        maxWidth: '768px',
                        margin: '0 auto',
                        display: 'flex',
                        gap: '20px',
                        padding: '0 20px'
                    }}>
                        <div style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '2px',
                            background: msg.role === 'user' ? '#5436DA' : '#10a37f',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}>
                            {msg.role === 'user' ? 'U' : 'A'}
                        </div>
                        <div style={{
                            flex: 1,
                            lineHeight: '1.6',
                            whiteSpace: 'pre-wrap'
                        }}>
                            {msg.content}
                        </div>
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
};
