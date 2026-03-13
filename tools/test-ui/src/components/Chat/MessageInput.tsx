import React, { useState, type KeyboardEvent, useRef, useEffect } from 'react';

interface MessageInputProps {
    onSendMessage: (content: string) => void;
    isLoading: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isLoading }) => {
    const [input, setInput] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isLoading) {
                onSendMessage(input);
                setInput('');
            }
        }
    };

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    return (
        <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            padding: '20px 0 40px',
            background: 'linear-gradient(180deg, rgba(52,53,65,0) 0%, #343541 50%)'
        }}>
            <div style={{
                maxWidth: '768px',
                margin: '0 auto',
                padding: '0 20px',
                position: 'relative'
            }}>
                <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'var(--input-bg)',
                    borderRadius: '12px',
                    boxShadow: '0 0 15px rgba(0,0,0,0.1)',
                    border: '1px solid rgba(0,0,0,0.1)'
                }}>
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Send a message..."
                        style={{
                            width: '100%',
                            maxHeight: '200px',
                            padding: '16px 45px 16px 16px',
                            border: 'none',
                            background: 'transparent',
                            resize: 'none',
                            color: '#fff',
                            outline: 'none',
                            fontFamily: 'inherit',
                            fontSize: '1rem',
                            lineHeight: '1.5'
                        }}
                    />
                    <button
                        onClick={() => {
                            if (input.trim() && !isLoading) {
                                onSendMessage(input);
                                setInput('');
                            }
                        }}
                        disabled={!input.trim() || isLoading}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            bottom: '10px',
                            background: input.trim() ? 'var(--accent-color)' : 'transparent',
                            border: 'none',
                            borderRadius: '5px',
                            width: '30px',
                            height: '30px',
                            cursor: input.trim() ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: input.trim() ? '#fff' : '#8e8ea0',
                            transition: 'all 0.2s'
                        }}
                    >
                        <svg
                            stroke="currentColor"
                            fill="none"
                            strokeWidth="2"
                            viewBox="0 0 24 24"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            height="16"
                            width="16"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
