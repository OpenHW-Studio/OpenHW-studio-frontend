import React from 'react';

const TABS = [
  { 
    id: 'canvas', 
    label: 'Canvas', 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
        <line x1="6" y1="10" x2="6" y2="14" />
        <line x1="18" y1="10" x2="18" y2="14" />
      </svg>
    )
  },
  { 
    id: 'code', 
    label: 'Code', 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    )
  },
  { 
    id: 'blocks', 
    label: 'Blocks', 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10h4v4H7z" />
        <path d="M13 10h4v4h-4z" />
        <path d="M10 7h4v4h-4z" />
        <path d="M10 13h4v4h-4z" />
        <rect x="3" y="3" width="18" height="18" rx="2" />
      </svg>
    )
  },
  { 
    id: 'serial', 
    label: 'Serial', 
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 4 5" />
        <line x1="12" y1="19" x2="20" y2="19" />
      </svg>
    )
  }
];

export default function MobileBottomNav({ activeTab, onTabChange, isRunning, handleToggleRun }) {
  return (
    <nav style={{
      height: '72px',
      background: 'rgba(13, 17, 23, 0.8)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px',
      paddingBottom: 'env(safe-area-inset-bottom)',
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
    }}>
      {TABS.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        const isMiddle = idx === 2; // Insert Run button before Serial

        return (
          <React.Fragment key={tab.id}>
            {isMiddle && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20%' }}>
                <button
                  onClick={handleToggleRun}
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: isRunning ? 'var(--red)' : 'var(--accent)',
                    border: 'none',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isRunning ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 0 20px rgba(0, 180, 255, 0.4)',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: 'translateY(-4px)',
                    zIndex: 1001,
                  }}
                  className="active:scale-90"
                >
                  {isRunning ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '2px' }}><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  )}
                </button>
              </div>
            )}
            <button
              onClick={() => onTabChange(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                padding: '8px',
                transition: 'all 0.2s ease',
                width: '20%',
                fontFamily: 'inherit',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s ease',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
              }}>
                {tab.icon}
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.01em',
              }}>
                {tab.label}
              </span>
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
