import React, { useState } from 'react';

export default function AutofixPreviewPanel({ validationErrors = [], autofixPlan, autofixStatus = 'Ready', autofixLog = [], onApplyPlan, onRefresh, className = '' }) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showSystemLog, setShowSystemLog] = useState(false);
  
  React.useEffect(() => {
    console.log('[AutofixPreviewPanel] Mounted with status:', autofixStatus);
    return () => console.log('[AutofixPreviewPanel] Unmounted');
  }, []);


  if (validationErrors.length === 0) {
    return (
      <div className={`autofix-panel text-center p-8 ${className}`}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Circuit is Healthy</h3>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginTop: 8 }}>No violations detected by the engine.</p>
        <button 
          onClick={onRefresh}
          style={{
            marginTop: 16, background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)',
            color: '#38bdf8', padding: '6px 12px', borderRadius: 8, fontSize: 11, cursor: 'pointer'
          }}
        >
          Check Again
        </button>
      </div>
    );
  }

  return (
    <div className={`autofix-preview-panel ${className}`} style={{ 
      fontFamily: "'Space Grotesk', sans-serif",
      pointerEvents: 'auto',
      position: 'relative'
    }}>
      <style>{`
        @keyframes appear {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, background: 'rgba(56, 189, 248, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 700, margin: 0 }}>Intelligent Repair</h3>
            <p style={{ color: 'var(--text3)', fontSize: 11, margin: 0 }}>WASM Engine analyzed {validationErrors.length} issue(s)</p>
          </div>
        </div>
        
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onRefresh) onRefresh();
          }}
          disabled={autofixStatus === 'Analyzing'}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text3)', cursor: 'pointer', transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
            style={{ animation: autofixStatus === 'Analyzing' ? 'spin 1s linear infinite' : 'none' }}>
            <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {autofixPlan ? (
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14, padding: 16, animation: 'appear 0.4s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ 
                fontSize: 10, fontWeight: 800, color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase'
              }}>Recommended Fix</span>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>{Math.round(autofixPlan.confidence * 100)}% Confidence</span>
            </div>
            
            <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 8px 0' }}>{autofixPlan.description}</h4>
            
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 16 }}>
              The engine will automatically {autofixPlan.description.toLowerCase()} to restore circuit integrity.
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                 {(autofixPlan.addedComponents || []).length > 0 && <span style={{ color: 'var(--accent)' }}>+ {autofixPlan.addedComponents.length} Components</span>}
                 {(autofixPlan.addedWires || []).length > 0 && <span style={{ color: 'var(--green)' }}>+ {autofixPlan.addedWires.length} Wires</span>}
                 {(autofixPlan.removedWires || []).length > 0 && <span style={{ color: 'var(--red)' }}>- {autofixPlan.removedWires.length} Wires</span>}
              </div>
            </div>

            <button 
              onClick={(e) => {
                e.stopPropagation();
                console.log('[AutofixPreviewPanel] Apply Plan clicked');
                if (typeof onApplyPlan === 'function') {
                  onApplyPlan(autofixPlan);
                } else {
                  console.warn('[AutofixPreviewPanel] onApplyPlan is not a function');
                }
              }}
              style={{
                width: '100%', padding: '12px', borderRadius: 10, background: '#38bdf8',
                color: '#fff', border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(56, 189, 248, 0.3)', transition: 'all 0.2s',
                marginBottom: 12
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              Apply Intelligent Repair
            </button>

            {autofixPlan.reasoning && autofixPlan.reasoning.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log('[AutofixPreviewPanel] Toggle Reasoning clicked. Current:', showReasoning);
                    setShowReasoning(!showReasoning);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', 
                    color: 'var(--text2)', fontSize: 10,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 10px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em'
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: showReasoning ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                  {showReasoning ? 'Hide reasoning trace' : 'View reasoning trace'}
                </button>
                
                {showReasoning && (
                  <div style={{ 
                    marginTop: 10, background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: 10,
                    fontSize: 11, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6,
                    borderLeft: '2px solid rgba(56, 189, 248, 0.3)'
                  }}>
                    {autofixPlan.reasoning.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: idx === autofixPlan.reasoning.length - 1 ? 0 : 6 }}>
                        <span style={{ color: '#38bdf8', opacity: 0.5 }}>0{idx + 1}</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', padding: '30px 20px', background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: 14, border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🧠</div>
            <p style={{ color: 'var(--text3)', fontSize: 12, margin: 0 }}>
              {autofixStatus}... The WASM brain is calculating the optimal repair plan.
            </p>
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              console.log('[AutofixPreviewPanel] Toggle System Log clicked. Current:', showSystemLog);
              setShowSystemLog(!showSystemLog);
            }}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: 8, padding: '8px 12px', color: 'var(--text3)', fontSize: 10,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}
          >
            <span>Engine System Log</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: showSystemLog ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          {showSystemLog && (
            <div style={{ 
              marginTop: 10, background: '#000', borderRadius: 8, padding: 12,
              maxHeight: 150, overflowY: 'auto', fontFamily: 'JetBrains Mono, monospace', fontSize: 9
            }}>
              {autofixLog.length === 0 ? (
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>No system events recorded.</div>
              ) : (
                autofixLog.map((log, i) => (
                  <div key={i} style={{ marginBottom: 4, display: 'flex', gap: 8 }}>
                    <span style={{ color: 'rgba(255,255,255,0.3)' }}>[{log.time}]</span>
                    <span style={{ color: '#38bdf8' }}>{log.msg}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
