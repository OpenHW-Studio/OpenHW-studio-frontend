import React, { useState, useRef, useEffect } from 'react';

// Format bytes for the UI
const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Main Panel Component that exactly mimics the mockup image
const NetworkPanel = ({ comp, networkStatus, onClose, onToggleGateway, onDownloadPcap, gatewayIp }) => {
  const panelRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Prevent event bubbling so canvas doesn't drag
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <div
      ref={panelRef}
      onMouseDown={stopPropagation}
      onClick={stopPropagation}
      onDoubleClick={stopPropagation}
      style={{
        position: 'absolute',
        top: '24px', // right below the icon
        right: 0,
        width: '260px',
        background: '#2A2A2A',
        borderRadius: '4px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#E0E0E0',
        overflow: 'hidden',
        pointerEvents: 'auto',
      }}
    >
      {/* Stats Header (Dark Grey Banner) */}
      <div style={{
        background: '#454545',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '14px',
        fontWeight: 500
      }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
            {formatBytes(networkStatus.txBytes)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
            {formatBytes(networkStatus.rxBytes)}
          </span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {networkStatus.isPrivate ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              Private
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
              Public
            </>
          )}
        </span>
      </div>
      <div style={{
        background: '#333',
        padding: '8px 16px',
        fontSize: '12px',
        color: '#AAA',
        borderTop: '1px solid #454545',
        fontFamily: 'monospace'
      }}>
        Gateway: {gatewayIp}
      </div>
      {/* Gateway Toggle Button */}
      <div style={{ padding: '16px' }}>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onToggleGateway(!networkStatus.isPrivate);
          }}
          style={{
            width: '100%',
            background: '#2196F3',
            color: '#FFFFFF',
            border: 'none',
            padding: '10px',
            borderRadius: '4px',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          {networkStatus.isPrivate ? 'DISABLE PRIVATE GATEWAY' : 'ENABLE PRIVATE GATEWAY'}
        </button>
      </div>

      <div style={{ height: '1px', background: '#3A3A3A', margin: '0' }} />

      {/* Action Links */}
      <div style={{ padding: '8px 0' }}>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            onDownloadPcap?.(comp.id);
            onClose();
          }}
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            fontSize: '15px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#3A3A3A'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download PCAP file
        </div>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            // window.open("", "_blank");
            onClose();
          }}
          style={{
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            fontSize: '15px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#3A3A3A'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
          WiFi Documentation
        </div>
      </div>
    </div>
  );
};

export const NetworkComponentOverlay = ({
  components,
  isRunning,
  updateComponentAttr
}) => {
  const [activeMenuCompId, setActiveMenuCompId] = useState(null);
  const [boardStats, setBoardStats] = useState({});
  const [gatewayIp, setGatewayIp] = useState('Resolving...');

  useEffect(() => {
    const handleStats = (e) => {
      const boardId = e.detail?.boardId;
      if (boardId) {
        const stats = e.detail.status || e.detail;
        setBoardStats(prev => ({
          ...prev,
          [boardId]: {
            txBytes: stats.txBytes || prev[boardId]?.txBytes || 0,
            rxBytes: stats.rxBytes || prev[boardId]?.rxBytes || 0,
          }
        }));
      }
    };
    window.addEventListener('OPENHW_WIFI_STATS', handleStats);
    return () => window.removeEventListener('OPENHW_WIFI_STATS', handleStats);
  }, []);

  useEffect(() => {
    const isPrivate = false; // Simplified for logic consistency
    const wsUrl = !isPrivate ? 'ws://localhost:5099' : (import.meta.env.VITE_PUBLIC_GATEWAY_URL || 'wss://api.openhw-studio.com:5099');
    try {
      const urlObj = new URL(wsUrl);
      const host = urlObj.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        setGatewayIp(`127.0.0.1:${urlObj.port || 5099}`);
      } else {
        fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, {
          headers: { 'accept': 'application/dns-json' }
        })
        .then(res => res.json())
        .then(data => {
          if (data.Answer && data.Answer.length > 0) {
            setGatewayIp(`${data.Answer[0].data}:${urlObj.port || 5099}`);
          } else {
            setGatewayIp(host);
          }
        })
        .catch(() => setGatewayIp(host));
      }
    } catch (e) {
      setGatewayIp(wsUrl);
    }
  }, []);

  if (!isRunning) return null;

  // Filter for network capable components
  const networkCapableComps = components.filter(c => {
    const t = c.type.toLowerCase();
    return t.includes('esp32') || t.includes('pico-w') || t.includes('openhw-ap');
  });

  if (networkCapableComps.length === 0) return null;

  const handleToggleGateway = (compId, isPrivate) => {
    updateComponentAttr?.(compId, 'privateGateway', isPrivate ? 'true' : 'false');
  };

  const handleDownloadPcap = (compId) => {
    window.dispatchEvent(new CustomEvent('network:download-pcap', {
      detail: { componentId: compId }
    }));
    setActiveMenuCompId(null);
  };

  return (
    <>
      {networkCapableComps.map(comp => {
        const isMenuOpen = activeMenuCompId === comp.id;
        return (
          <div
            key={`wifi-overlay-${comp.id}`}
            style={{
              position: 'absolute',
              left: comp.x + comp.w - 10,
              top: comp.y - 10,
              zIndex: 300, // Above components
            }}
          >
            {/* The Trigger Icon */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                setActiveMenuCompId(isMenuOpen ? null : comp.id);
              }}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                background: isMenuOpen ? '#2196F3' : '#333',
                color: '#FFF',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                border: '2px solid #222'
              }}
              title="Network Status"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                <line x1="12" y1="20" x2="12.01" y2="20" />
              </svg>
            </div>

            {/* The Floating Panel */}
            {isMenuOpen && (
              <NetworkPanel
                comp={comp}
                gatewayIp={gatewayIp}
                networkStatus={{
                  txBytes: boardStats[comp.id]?.txBytes || 0,
                  rxBytes: boardStats[comp.id]?.rxBytes || 0,
                  isPrivate: comp.attrs?.privateGateway === 'true'
                }}
                onClose={() => setActiveMenuCompId(null)}
                onToggleGateway={(isPrivate) => handleToggleGateway(comp.id, isPrivate)}
                onDownloadPcap={handleDownloadPcap}
              />
            )}
          </div>
        );
      })}
    </>
  );
};
