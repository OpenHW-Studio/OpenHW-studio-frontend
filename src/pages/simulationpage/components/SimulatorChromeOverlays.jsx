import React from 'react';

function SimulatorChromeOverlaysBase({
  previewBanner,
  setPreviewBanner,
  isExporting,
  gamificationMode,
  gamProject,
  navigate,
  currentLevelData,
  currentLevel,
  xpProgress,
  nextLevel,
  coins,
  gamAllUnlocked,
  gamLockedCount,
  gamPanelOpen,
  setGamPanelOpen,
  handleGamificationSubmit,
  lockToast,
  wireStart,
}) {
  return (
    <>
      {previewBanner && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
          background: 'linear-gradient(90deg, #92400e, #b45309)',
          color: '#fff', padding: '10px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontFamily: 'monospace', fontSize: 13, boxShadow: '0 2px 12px rgba(0,0,0,0.4)'
        }}>
          <span>
            🧪 <strong>Admin Preview Mode</strong> &nbsp;—&nbsp;
            Component <strong style={{ color: '#fde68a' }}>{previewBanner.label}</strong>
            &nbsp;(<code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 3 }}>{previewBanner.id}</code>)
            &nbsp;is injected in <strong>browser memory only</strong>. It is NOT approved or installed on the backend.
          </span>
          <button
            onClick={() => setPreviewBanner(null)}
            style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
          >✕ Dismiss</button>
        </div>
      )}

      {isExporting && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(7, 11, 20, 0.36)',
          backdropFilter: 'blur(2px)',
          pointerEvents: 'all'
        }}>
          <style>{`
            @keyframes openhw-png-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '18px 22px',
            borderRadius: 16,
            background: 'rgba(10, 15, 28, 0.94)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 18px 60px rgba(0,0,0,0.35)',
            minWidth: 220
          }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: '3px solid rgba(255,255,255,0.18)',
              borderTopColor: 'var(--accent)',
              animation: 'openhw-png-spin 0.9s linear infinite'
            }} />
            <div style={{ color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>Exporting to PNG</div>
            <div style={{ color: 'var(--text3)', fontSize: 12 }}>Please wait while the image is rendered.</div>
          </div>
        </div>
      )}

      {gamificationMode && gamProject && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px',
          background: 'rgba(7,8,15,0.97)', borderBottom: `2px solid ${gamProject.color || '#22c55e'}44`,
          fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0, flexWrap: 'wrap', zIndex: 50,
        }}>
          <button
            onClick={() => navigate('/projects')}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.12)', color: 'rgba(255,255,255,.55)', borderRadius: 7, padding: '4px 11px', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
          >← Projects</button>

          <span style={{ fontSize: 18, flexShrink: 0 }}>{gamProject.icon}</span>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{gamProject.title}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
              Project {String(gamProject.number).padStart(2, '0')} ·{' '}
              <span style={{ color: gamProject.color || '#22c55e' }}>{gamProject.difficultyLabel}</span>
              {' '}· ⏱ {gamProject.estimatedTime}
            </div>
          </div>

          <div style={{ flex: 1 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: `${currentLevelData?.color || '#22c55e'}22`,
              border: `2px solid ${currentLevelData?.color || '#22c55e'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 800, color: currentLevelData?.color || '#22c55e',
            }}>{currentLevel}</div>
            <div style={{ width: 90 }}>
              <div style={{ height: 3, borderRadius: 999, background: 'rgba(255,255,255,.1)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 999, width: `${xpProgress}%`, background: `${currentLevelData?.color || '#22c55e'}` }} />
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{xpProgress}% to Lvl {nextLevel?.id ?? '—'}</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 7, padding: '4px 9px', flexShrink: 0 }}>
            <span style={{ fontSize: 13 }}>🪙</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fbbf24' }}>{coins}</span>
          </div>

          <div style={{ fontSize: 10, color: '#22c55e', background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', borderRadius: 7, padding: '4px 9px', flexShrink: 0, fontWeight: 700 }}>
            +{gamProject.xpReward} XP on complete
          </div>

          <div style={{
            fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 7,
            background: gamAllUnlocked ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
            border: `1px solid ${gamAllUnlocked ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
            color: gamAllUnlocked ? '#22c55e' : '#ef4444', flexShrink: 0,
          }}>
            {gamAllUnlocked ? '✅ All unlocked' : `🔒 ${gamLockedCount} locked`}
          </div>

          <button
            onClick={() => setGamPanelOpen((p) => !p)}
            style={{
              background: gamPanelOpen ? 'rgba(0,180,255,.1)' : 'transparent',
              border: `1px solid ${gamPanelOpen ? 'rgba(0,180,255,.3)' : 'rgba(255,255,255,.12)'}`,
              color: gamPanelOpen ? '#00b4ff' : 'rgba(255,255,255,.5)',
              borderRadius: 7, padding: '4px 11px', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >{gamPanelOpen ? '⟩ Hide Guide' : '⟨ Guide'}</button>

          <button
            onClick={handleGamificationSubmit}
            style={{
              background: gamProject.color || '#22c55e', border: 'none', color: '#fff',
              borderRadius: 7, padding: '5px 13px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >Submit →</button>
        </div>
      )}

      {lockToast && (
        <div style={{
          position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(7, 11, 25, 0.95)', border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)', padding: '12px 20px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 12, zIndex: 9999, animation: 'slideUp 0.3s ease-out'
        }}>
          <span style={{ fontSize: 24 }}>🔒</span>
          <div>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 14 }}>{lockToast.label} is Locked</div>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Study the theory and pass the quiz to unlock this component.</div>
          </div>
          {lockToast.compId && (
            <button
              onClick={() => navigate(`/components/${lockToast.compId}/theory`)}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer', fontSize: 12, marginLeft: 8 }}
            >Study Now</button>
          )}
        </div>
      )}

      {wireStart && (
        <div className="bg-[rgba(255,145,0,.1)] border-b border-[rgba(255,145,0,.25)] text-[var(--orange)] px-5 py-2 text-[13px] flex items-center shrink-0" style={{ background: 'rgba(255,170,0,.12)', borderColor: 'rgba(255,170,0,.3)', color: 'var(--orange)' }}>
          〰 <strong>Wiring in progress</strong> — Click another pin to connect. Press Esc to cancel.
          <span style={{ marginLeft: 12 }}>🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong></span>
        </div>
      )}
    </>
  );
}

export const SimulatorChromeOverlays = React.memo(SimulatorChromeOverlaysBase);
