
import { useState, useEffect } from 'react';
import { useGamification } from '../../context/GamificationContext';
import { LEVELS, RARITY_CONFIG, getComponentUnlockLevel } from './GamificationConfig';

export function GamificationPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('progress'); 
  const {
    xp, currentLevel, currentLevelData, nextLevel, xpProgress,
    earnedBadges, completedLevels,
    totalComponentsPlaced, totalWiresDrawn, totalSimulationsRun,
    completeLevel, resetProgress,
  } = useGamification();

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Gamification Progress"
        style={{
          position: 'fixed', bottom: 72, right: 16, zIndex: 500,
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20,
          boxShadow: '0 4px 20px rgba(251,191,36,0.5)',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        🏆
        {/* Level badge */}
        <span style={{
          position: 'absolute', top: -4, right: -4,
          width: 18, height: 18, borderRadius: '50%',
          background: currentLevelData?.color || '#22c55e',
          border: '2px solid var(--bg, #07080f)',
          fontSize: 9, fontWeight: 800, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'monospace',
        }}>{currentLevel}</span>
      </button>

      {/* ── Drawer Overlay ─────────────────────────────────────────────────── */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 499, background: 'transparent' }}
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Drawer Panel ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 600,
        width: open ? 360 : 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: open ? 'auto' : 'none',
      }}>
        <div style={{
          width: 360, height: '100%',
          background: '#0d1220',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Space Grotesk', sans-serif",
          boxShadow: '-8px 0 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '20px 20px 0',
            background: 'linear-gradient(180deg, #0a1628 0%, #0d1220 100%)',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 24 }}>🏆</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Progression</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {earnedBadges.length} badge{earnedBadges.length !== 1 ? 's' : ''} earned
                  </div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* XP Bar */}
            <XPBar xp={xp} currentLevel={currentLevel} currentLevelData={currentLevelData} nextLevel={nextLevel} xpProgress={xpProgress} />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
              {[['progress', '🗺️ Levels'], ['badges', '🏅 Badges']].map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  flex: 1, padding: '8px 4px', borderRadius: '8px 8px 0 0',
                  border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  fontFamily: 'inherit',
                  background: activeTab === tab ? '#0d1220' : 'rgba(255,255,255,0.04)',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.4)',
                  borderBottom: activeTab === tab ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px' }}>
            {activeTab === 'progress' && (
              <LevelsTab
                currentLevel={currentLevel}
                completedLevels={completedLevels}
                earnedBadges={earnedBadges}
                completeLevel={completeLevel}
              />
            )}
            {activeTab === 'badges' && (
              <BadgesTab earnedBadges={earnedBadges} />
            )}
          </div>

          {/* Footer stats */}
          <div style={{
            flexShrink: 0, padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
          }}>
            {[
              { label: 'Components', value: totalComponentsPlaced, icon: '🔌' },
              { label: 'Wires', value: totalWiresDrawn, icon: '〰️' },
              { label: 'Simulations', value: totalSimulationsRun, icon: '▶️' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.04)', borderRadius: 8,
                padding: '8px 6px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ fontSize: 16 }}>{icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '2px 0' }}>{value}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── XP Bar ───────────────────────────────────────────────────────────────────
function XPBar({ xp, currentLevel, currentLevelData, nextLevel, xpProgress }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: `linear-gradient(135deg, ${currentLevelData?.color || '#22c55e'}, ${currentLevelData?.color || '#22c55e'}88)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            boxShadow: `0 0 16px ${currentLevelData?.color || '#22c55e'}55`,
          }}>
            {currentLevelData?.icon || '⚡'}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Level {currentLevel}</div>
            <div style={{ fontSize: 11, color: currentLevelData?.color || '#22c55e', fontWeight: 600 }}>
              {currentLevelData?.title || ''}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24', letterSpacing: '-0.02em' }}>
            {xp.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>Total XP</div>
        </div>
      </div>

      {/* Progress bar */}
      {nextLevel && (
        <>
          <div style={{
            height: 6, borderRadius: 999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden', marginBottom: 6,
          }}>
            <div style={{
              height: '100%',
              width: `${xpProgress}%`,
              borderRadius: 999,
              background: `linear-gradient(90deg, ${currentLevelData?.color || '#22c55e'}, ${nextLevel?.color || '#3b82f6'})`,
              transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: `0 0 8px ${currentLevelData?.color || '#22c55e'}88`,
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
            <span>{xpProgress}% to Level {nextLevel.id}</span>
            <span>{(nextLevel.xpRequired - xp).toLocaleString()} XP remaining</span>
          </div>
        </>
      )}
      {!nextLevel && (
        <div style={{ fontSize: 12, color: '#fbbf24', fontWeight: 700, textAlign: 'center', marginTop: 4 }}>
          🏆 MAX LEVEL REACHED
        </div>
      )}
    </div>
  );
}

// ─── Levels Tab ───────────────────────────────────────────────────────────────
function LevelsTab({ currentLevel, completedLevels, earnedBadges, completeLevel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {LEVELS.map(lvl => {
        const isCompleted = completedLevels.includes(lvl.id);
        const isCurrent = lvl.id === currentLevel;
        const isLocked = lvl.id > currentLevel;
        const hasBadge = earnedBadges.includes(lvl.badge.id);
        const rarity = RARITY_CONFIG[lvl.badge.rarity];

        return (
          <div key={lvl.id} style={{
            borderRadius: 12,
            border: `1px solid ${isLocked ? 'rgba(255,255,255,0.05)' : isCurrent ? `${lvl.color}55` : `${lvl.color}33`}`,
            background: isLocked
              ? 'rgba(255,255,255,0.02)'
              : isCurrent
              ? `linear-gradient(135deg, ${lvl.color}12, rgba(255,255,255,0.03))`
              : 'rgba(255,255,255,0.03)',
            overflow: 'hidden',
            opacity: isLocked ? 0.5 : 1,
            transition: 'all 0.2s',
          }}>
            {/* Level row header */}
            <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Icon bubble */}
              <div style={{
                width: 38, height: 38, flexShrink: 0, borderRadius: '50%',
                background: isLocked
                  ? 'rgba(255,255,255,0.06)'
                  : `linear-gradient(135deg, ${lvl.color}44, ${lvl.color}22)`,
                border: `2px solid ${isLocked ? 'rgba(255,255,255,0.1)' : lvl.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isLocked ? 16 : 20,
                boxShadow: isCompleted ? `0 0 14px ${lvl.color}55` : 'none',
              }}>
                {isLocked ? '🔒' : lvl.icon}
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: isLocked ? 'rgba(255,255,255,0.3)' : '#fff' }}>
                    Level {lvl.id} — {lvl.title}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: lvl.color,
                      background: `${lvl.color}22`, border: `1px solid ${lvl.color}55`,
                      borderRadius: 4, padding: '1px 5px', textTransform: 'uppercase', flexShrink: 0,
                    }}>Current</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  {lvl.subtitle}
                </div>
              </div>

              {/* Badge / Status */}
              <div style={{ flexShrink: 0, textAlign: 'center' }}>
                {hasBadge ? (
                  <div style={{ fontSize: 22 }} title={lvl.badge.name}>{lvl.badge.icon}</div>
                ) : (
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: isLocked ? 'rgba(255,255,255,0.2)' : rarity.color,
                  }}>
                    +{lvl.xpReward} XP
                  </div>
                )}
              </div>
            </div>

            {/* Objectives — only show for current/completed */}
            {(isCurrent || isCompleted) && (
              <div style={{
                borderTop: `1px solid ${lvl.color}22`,
                padding: '10px 14px',
                background: 'rgba(0,0,0,0.2)',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Objectives
                </div>
                {lvl.objectives.map((obj, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                    padding: '4px 0', fontSize: 12, color: isCompleted ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.75)',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                  }}>
                    <span style={{
                      width: 16, height: 16, flexShrink: 0,
                      borderRadius: '50%',
                      background: isCompleted ? `${lvl.color}44` : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isCompleted ? lvl.color : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, marginTop: 1,
                    }}>
                      {isCompleted ? '✓' : i + 1}
                    </span>
                    {obj}
                  </div>
                ))}

                {/* Unlocks row */}
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginRight: 4 }}>Unlocks:</span>
                  {lvl.unlockedComponents.includes('*')
                    ? <span style={{ fontSize: 10, color: lvl.color, fontWeight: 700 }}>All Components 🎉</span>
                    : lvl.unlockedComponents.map(type => (
                      <span key={type} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                        background: `${lvl.color}18`, border: `1px solid ${lvl.color}44`,
                        color: lvl.color, fontFamily: 'monospace',
                      }}>
                        {type.replace('wokwi-', '')}
                      </span>
                    ))
                  }
                </div>

                {/* Complete button — dev/demo, replace with assessment trigger in production */}
                {isCurrent && !isCompleted && (
                  <button
                    onClick={() => completeLevel(lvl.id)}
                    style={{
                      marginTop: 12, width: '100%', padding: '8px',
                      borderRadius: 8, border: `1px solid ${lvl.color}`,
                      background: `${lvl.color}22`, color: lvl.color,
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = `${lvl.color}44`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = `${lvl.color}22`; }}
                  >
                    ✓ Mark Level Complete (demo)
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Badges Tab ───────────────────────────────────────────────────────────────
function BadgesTab({ earnedBadges }) {
  const allBadges = LEVELS.map(l => l.badge);
  const earned = allBadges.filter(b => earnedBadges.includes(b.id));
  const locked = allBadges.filter(b => !earnedBadges.includes(b.id));

  return (
    <div>
      {/* Earned */}
      {earned.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Earned ({earned.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 20 }}>
            {earned.map(badge => <BadgeCard key={badge.id} badge={badge} unlocked />)}
          </div>
        </>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Locked ({locked.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {locked.map(badge => <BadgeCard key={badge.id} badge={badge} unlocked={false} />)}
          </div>
        </>
      )}

      {earned.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏅</div>
          Complete levels to earn badges
        </div>
      )}
    </div>
  );
}

function BadgeCard({ badge, unlocked }) {
  const rarity = RARITY_CONFIG[badge.rarity];
  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${unlocked ? rarity.color + '55' : 'rgba(255,255,255,0.06)'}`,
      background: unlocked ? `linear-gradient(135deg, ${rarity.glow}, rgba(255,255,255,0.02))` : 'rgba(255,255,255,0.02)',
      padding: '12px 10px', textAlign: 'center',
      opacity: unlocked ? 1 : 0.45,
      filter: unlocked ? 'none' : 'grayscale(1)',
      transition: 'all 0.2s',
    }}>
      <div style={{
        fontSize: 32, marginBottom: 6,
        filter: unlocked ? `drop-shadow(0 0 8px ${rarity.color}88)` : 'none',
      }}>
        {unlocked ? badge.icon : '🔒'}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: unlocked ? '#fff' : 'rgba(255,255,255,0.3)', marginBottom: 3, lineHeight: 1.3 }}>
        {badge.name}
      </div>
      <div style={{
        display: 'inline-block', fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: `${rarity.color}22`, color: rarity.color,
        border: `1px solid ${rarity.color}44`, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>
        {rarity.label}
      </div>
      {unlocked && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6, lineHeight: 1.4 }}>
          {badge.description}
        </div>
      )}
    </div>
  );
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
export function GamificationToasts() {
  const { notifications, dismissNotification } = useGamification();

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9990, display: 'flex', flexDirection: 'column-reverse',
      alignItems: 'center', gap: 10, pointerEvents: 'none',
    }}>
      {notifications.map(n => (
        <Toast key={n.id} notification={n} onDismiss={() => dismissNotification(n.id)} />
      ))}
    </div>
  );
}

function Toast({ notification: n, onDismiss }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  return (
    <div
      onClick={onDismiss}
      style={{
        pointerEvents: 'auto', cursor: 'pointer',
        minWidth: 280, maxWidth: 380,
        background: '#0d1628',
        border: `1px solid ${n.color || '#22c55e'}55`,
        borderRadius: 14, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 24px ${n.color || '#22c55e'}22`,
        fontFamily: "'Space Grotesk', sans-serif",
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.95)',
        transition: 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: `${n.color || '#22c55e'}22`,
        border: `2px solid ${n.color || '#22c55e'}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: n.type === 'levelup' ? 22 : 20,
        boxShadow: `0 0 16px ${n.color || '#22c55e'}44`,
      }}>
        {n.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 2 }}>{n.title}</div>
        {n.subtitle && (
          <div style={{ fontSize: 12, color: n.color || '#22c55e', fontWeight: 600 }}>{n.subtitle}</div>
        )}
        {n.description && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 1.4 }}>
            {n.description}
          </div>
        )}
        {n.type === 'levelup' && n.newComponents?.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {n.newComponents.map(c => (
              <span key={c} style={{
                fontSize: 9, padding: '1px 5px', borderRadius: 4,
                background: `${n.color}22`, border: `1px solid ${n.color}44`,
                color: n.color, fontFamily: 'monospace',
              }}>{c.replace('wokwi-', '')}</span>
            ))}
          </div>
        )}
      </div>

      {/* Type badge */}
      {n.type === 'levelup' && (
        <div style={{
          flexShrink: 0, padding: '3px 8px', borderRadius: 6,
          background: `${n.color}22`, border: `1px solid ${n.color}55`,
          fontSize: 9, fontWeight: 800, color: n.color,
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>Level Up!</div>
      )}
      {n.type === 'badge' && (
        <div style={{
          flexShrink: 0, padding: '3px 8px', borderRadius: 6,
          background: '#fbbf2422', border: '1px solid #fbbf2455',
          fontSize: 9, fontWeight: 800, color: '#fbbf24',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>Badge!</div>
      )}
    </div>
  );
}


export function ComponentLockOverlay({ type, children }) {
  const { isUnlocked, currentLevel } = useGamification();

  if (isUnlocked(type)) return children;

  const unlockAt = getComponentUnlockLevel(type);
  return (
    <div style={{ position: 'relative', pointerEvents: 'none', userSelect: 'none' }}>
      <div style={{ opacity: 0.25, filter: 'grayscale(1)' }}>{children}</div>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 3,
        background: 'rgba(7,8,15,0.7)', borderRadius: 'inherit',
        pointerEvents: 'auto', cursor: 'not-allowed',
      }}>
        <span style={{ fontSize: 14 }}>🔒</span>
        {unlockAt && (
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textAlign: 'center', lineHeight: 1.3 }}>
            Level {unlockAt}
          </span>
        )}
      </div>
    </div>
  );
}