import React from 'react';

function GamificationGuidePanelBase({
  gamTab,
  setGamTab,
  gamProject,
  gamAllUnlocked,
  gamLockedCount,
  gamProjectComponents,
  navigate,
  handleGamificationSubmit,
}) {
  return (
    <aside style={{
      width: 280, background: '#0a0d1a', borderLeft: '1px solid rgba(255,255,255,.07)',
      display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
      fontFamily: "'Space Grotesk', sans-serif",
    }}>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
        {[{ id: 'components', label: '🔧 Parts' }, { id: 'wiring', label: '〰 Wiring' }, { id: 'concepts', label: '📚 Code' }].map(tab => (
          <button key={tab.id} onClick={() => setGamTab(tab.id)} style={{
            flex: 1, padding: '9px 4px', background: 'none', border: 'none',
            borderBottom: `2px solid ${gamTab === tab.id ? '#00b4ff' : 'transparent'}`,
            color: gamTab === tab.id ? '#00b4ff' : 'rgba(255,255,255,.4)',
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{tab.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 80px' }}>

        {gamTab === 'components' && (
          <div>
            <div style={{
              padding: '9px 12px', borderRadius: 9, marginBottom: 14,
              background: gamAllUnlocked ? 'rgba(34,197,94,.08)' : 'rgba(239,68,68,.08)',
              border: `1px solid ${gamAllUnlocked ? 'rgba(34,197,94,.25)' : 'rgba(239,68,68,.25)'}`,
              fontSize: 12, fontWeight: 600,
              color: gamAllUnlocked ? '#22c55e' : '#ef4444',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {gamAllUnlocked ? '✅ All components unlocked' : `⚠️ ${gamLockedCount} need unlocking`}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {(gamProjectComponents || []).map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '9px 11px', borderRadius: 9,
                  background: c.isLocked ? 'rgba(239,68,68,.05)' : 'rgba(34,197,94,.05)',
                  border: `1px solid ${c.isLocked ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.18)'}`,
                }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{c.isLocked ? '🔒' : (c.compDef?.icon || '✅')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: c.isLocked ? 'rgba(255,255,255,.45)' : '#fff' }}>
                      {c.qty > 1 ? `${c.qty}× ` : ''}{c.label}
                    </div>
                    <div style={{ fontSize: 9, color: c.isLocked ? '#ef4444' : '#22c55e', marginTop: 2 }}>
                      {c.isLocked ? 'Study theory to unlock' : 'Available in palette'}
                    </div>
                  </div>
                  {c.isLocked && c.compId && (
                    <button
                      onClick={() => navigate(`/components/${c.compId}/theory`)}
                      style={{ background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.35)', color: '#ef4444', borderRadius: 6, padding: '3px 7px', fontSize: 9, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                    >Unlock →</button>
                  )}
                </div>
              ))}
            </div>

            <button onClick={() => navigate('/components')} style={{ marginTop: 16, width: '100%', padding: '9px', background: 'rgba(0,180,255,.06)', border: '1px solid rgba(0,180,255,.2)', color: '#00b4ff', borderRadius: 9, fontFamily: 'inherit', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
              🔓 Unlock More Components
            </button>
          </div>
        )}

        {gamTab === 'wiring' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {gamProject?.wiring?.length > 0 ? gamProject.wiring.map((w, i) => (
              <div key={i} style={{ padding: '9px 11px', borderRadius: 8, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,180,255,.15)', border: '1px solid rgba(0,180,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#00b4ff', flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
                  <span style={{ color: '#00b4ff', fontFamily: 'monospace' }}>{w.from}</span>
                  <span style={{ color: 'rgba(255,255,255,.3)', margin: '0 5px' }}>→</span>
                  <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>{w.to}</span>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '32px 0' }}>No wiring guide yet.</div>
            )}
          </div>
        )}

        {gamTab === 'concepts' && gamProject && (
          <div>
            {gamProject.concepts?.length > 0 && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Concepts</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
                  {gamProject.concepts.map((c, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 6, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                      <span style={{ color: gamProject.color || '#22c55e', fontSize: 11 }}>▸</span>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', fontFamily: 'monospace' }}>{c}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {gamProject.starterCode && (
              <>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>Starter Code</div>
                <div style={{ background: 'rgba(0,0,0,.4)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 9, padding: '11px', overflow: 'auto' }}>
                  <pre style={{ margin: 0, fontSize: 10, color: '#a5f3fc', lineHeight: 1.7, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{gamProject.starterCode}</pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {gamProject && (
        <div style={{ flexShrink: 0, padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,.07)', background: 'rgba(0,0,0,.3)' }}>
          <button
            onClick={handleGamificationSubmit}
            disabled={!gamAllUnlocked}
            style={{ width: '100%', padding: '10px', background: gamAllUnlocked ? (gamProject.color || '#22c55e') : 'rgba(255,255,255,.05)', border: gamAllUnlocked ? 'none' : '1px solid rgba(255,255,255,.1)', color: gamAllUnlocked ? '#fff' : 'rgba(255,255,255,.25)', borderRadius: 9, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: gamAllUnlocked ? 'pointer' : 'not-allowed', marginBottom: 7 }}
            title={gamAllUnlocked ? '' : `Unlock ${gamLockedCount} component${gamLockedCount > 1 ? 's' : ''} first`}
          >
            {gamAllUnlocked ? '▶ Submit Assessment' : `🔒 Unlock ${gamLockedCount} first`}
          </button>
          <button onClick={() => navigate(`/${gamProject.slug}/guide`)} style={{ width: '100%', padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', color: 'rgba(255,255,255,.35)', borderRadius: 9, fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
            📖 Full Guide
          </button>
        </div>
      )}
    </aside>
  );
}

export const GamificationGuidePanel = React.memo(GamificationGuidePanelBase);
