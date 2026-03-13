import React from 'react';

interface ChatLayoutProps {
    children: React.ReactNode;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ children }) => {
    return (
        <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            {/* Sidebar */}
            <aside style={{
                width: '260px',
                backgroundColor: 'var(--sidebar-bg)',
                padding: '10px',
                display: 'flex',
                flexDirection: 'column',
                color: '#fff'
            }}>
                <button style={{
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
                <div style={{ flex: 1 }}>
                    {/* History items would go here */}
                    <div style={{ padding: '10px', color: '#8e8ea0', fontSize: '0.9rem' }}>
                        Chat History
                    </div>
                </div>
            </aside>

            {/* Main Chat Area */}
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
