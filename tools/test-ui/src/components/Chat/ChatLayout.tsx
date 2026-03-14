import React from 'react';

export type AppScreen = 'chat' | 'upload';

interface ChatLayoutProps {
    children: React.ReactNode;
    activeScreen: AppScreen;
    onScreenChange: (screen: AppScreen) => void;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ children, activeScreen, onScreenChange }) => {
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

                <div style={{ flex: 1 }}>
                    <div style={{ padding: '10px', color: '#8e8ea0', fontSize: '0.9rem' }}>
                        Chat History
                    </div>
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
