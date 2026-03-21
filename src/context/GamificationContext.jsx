import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LEVELS, getUnlockedComponents, isComponentUnlocked } from '../services/gamification/GamificationConfig.jsx';
import { PROJECTS } from '../services/gamification/ProjectsConfig.js';
import { useAuth } from './AuthContext.jsx';

// Storage key is user-specific so each account has isolated progress
const getStorageKey = (email) => `openhw_gamification_v2_${email || 'guest'}`;

const DEFAULT_STATE = {
  xp: 0,
  currentLevel: 1,
  earnedBadges: [],
  completedLevels: [],
  completedProjects: [],   // stores project slugs e.g. ['led-blink', 'rgb-led']
  levelProgress: {},
  totalComponentsPlaced: 0,
  totalWiresDrawn: 0,
  totalSimulationsRun: 0,
  coins: 0,
  unlockedComponents: [],
  componentXP: 0,
};

const GamificationContext = createContext(null);

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error('useGamification must be used inside <GamificationProvider>');
  return ctx;
}

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const storageKey = getStorageKey(user?.email);

  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(null)); // guest default on first load
      return stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  // When user changes (login/logout), load that user's saved state
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      setState(stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE);
    } catch {
      setState(DEFAULT_STATE);
    }
  }, [storageKey]);

  const [notifications, setNotifications] = useState([]);

  // Persist to user-specific key on every state change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {}
  }, [state, storageKey]);

  const pushNotification = useCallback((notification) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, ...notification }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, notification.duration || 4500);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const awardXP = useCallback((amount, reason = '') => {
    setState(prev => {
      const newXP = prev.xp + amount;

      // Determine new level based on accumulated XP
      let newLevel = prev.currentLevel;
      for (const lvl of LEVELS) {
        if (newXP >= lvl.xpRequired && lvl.id > newLevel) {
          newLevel = lvl.id;
        }
      }

      if (newLevel > prev.currentLevel) {
        const lvlData = LEVELS.find(l => l.id === newLevel);
        setTimeout(() => {
          pushNotification({
            type: 'levelup',
            title: `Level ${newLevel} Reached!`,
            subtitle: lvlData?.title || '',
            icon: lvlData?.icon || '🎉',
            color: lvlData?.color || '#22c55e',
            xp: amount,
            duration: 6000,
          });
        }, 0);
      } else if (amount > 0) {
        setTimeout(() => {
          pushNotification({
            type: 'xp',
            title: `+${amount} XP`,
            subtitle: reason,
            icon: '⚡',
            color: '#fbbf24',
            duration: 2500,
          });
        }, 0);
      }

      return { ...prev, xp: newXP, currentLevel: newLevel };
    });
  }, [pushNotification]);

  const completeLevel = useCallback((levelId) => {
    setState(prev => {
      if (prev.completedLevels.includes(levelId)) return prev; 

      const lvl = LEVELS.find(l => l.id === levelId);
      if (!lvl) return prev;

      const newXP = prev.xp + lvl.xpReward;
      const newBadges = [...prev.earnedBadges];
      if (!newBadges.includes(lvl.badge.id)) {
        newBadges.push(lvl.badge.id);
        // Badge notification fires after state update
        setTimeout(() => {
          pushNotification({
            type: 'badge',
            title: `Badge Earned!`,
            subtitle: lvl.badge.name,
            description: lvl.badge.description,
            icon: lvl.badge.icon,
            rarity: lvl.badge.rarity,
            color: lvl.color,
            duration: 5500,
          });
        }, 300);
      }

      // Level-up check
      let newLevel = prev.currentLevel;
      for (const l of LEVELS) {
        if (newXP >= l.xpRequired && l.id > newLevel) newLevel = l.id;
      }

      if (newLevel > prev.currentLevel) {
        const lvlData = LEVELS.find(l => l.id === newLevel);
        setTimeout(() => {
          pushNotification({
            type: 'levelup',
            title: `Level ${newLevel} Unlocked!`,
            subtitle: lvlData?.title || '',
            icon: lvlData?.icon || '🎉',
            color: lvlData?.color || '#22c55e',
            newComponents: lvlData?.unlockedComponents || [],
            duration: 7000,
          });
        }, 1200);
      }

      return {
        ...prev,
        xp: newXP,
        currentLevel: newLevel,
        completedLevels: [...prev.completedLevels, levelId],
        earnedBadges: newBadges,
      };
    });
  }, [pushNotification]);

  const unlockComponent = useCallback((componentId, xpReward = 0, coinReward = 0) => {
    setState(prev => {
      if (prev.unlockedComponents.includes(componentId)) return prev; // idempotent

      setTimeout(() => {
        pushNotification({
          type: 'unlock',
          title: `Component Unlocked!`,
          subtitle: `+${xpReward} XP · +${coinReward} coins`,
          icon: '🔓',
          color: '#22c55e',
          duration: 4000,
        });
      }, 0);

      return {
        ...prev,
        coins: prev.coins + coinReward,
        componentXP: (prev.componentXP || 0) + xpReward,
        unlockedComponents: [...prev.unlockedComponents, componentId],
      };
    });
  }, [pushNotification]);

  // ── Complete a Project (called from ProjectAssessmentPage on pass) ──────────
  // Uses PROJECTS data directly — fixes the badge ID mismatch with LEVELS.
  const completeProject = useCallback((projectSlug) => {
    setState(prev => {
      if (prev.completedProjects?.includes(projectSlug)) {
        // Already completed — award 25% bonus XP
        const project = PROJECTS.find(p => p.slug === projectSlug);
        const bonus = Math.round((project?.xpReward || 100) * 0.25);
        setTimeout(() => awardXP(bonus, 'Re-submission bonus'), 0);
        return prev;
      }

      const project = PROJECTS.find(p => p.slug === projectSlug);
      if (!project) return prev;

      const xpGain = project.xpReward || 100;
      const newXP = prev.xp + xpGain;
      const newBadges = [...prev.earnedBadges];

      if (project.badge?.id && !newBadges.includes(project.badge.id)) {
        newBadges.push(project.badge.id);
        setTimeout(() => {
          pushNotification({
            type: 'badge',
            title: 'Badge Earned!',
            subtitle: project.badge.name,
            description: project.badge.description,
            icon: project.badge.icon,
            rarity: project.badge.rarity,
            color: project.color || '#22c55e',
            duration: 5500,
          });
        }, 300);
      }

      // Level-up check
      let newLevel = prev.currentLevel;
      for (const l of LEVELS) {
        if (newXP >= l.xpRequired && l.id > newLevel) newLevel = l.id;
      }
      if (newLevel > prev.currentLevel) {
        const lvlData = LEVELS.find(l => l.id === newLevel);
        setTimeout(() => {
          pushNotification({
            type: 'levelup',
            title: `Level ${newLevel} Unlocked!`,
            subtitle: lvlData?.title || '',
            icon: lvlData?.icon || '🎉',
            color: lvlData?.color || '#22c55e',
            newComponents: lvlData?.unlockedComponents || [],
            duration: 7000,
          });
        }, 1200);
      }

      setTimeout(() => {
        pushNotification({
          type: 'xp',
          title: `+${xpGain} XP`,
          subtitle: `${project.title} completed!`,
          icon: project.icon || '⚡',
          color: '#fbbf24',
          duration: 3000,
        });
      }, 0);

      return {
        ...prev,
        xp: newXP,
        currentLevel: newLevel,
        earnedBadges: newBadges,
        completedProjects: [...(prev.completedProjects || []), projectSlug],
        completedLevels: prev.completedLevels.includes(project.levelRequired)
          ? prev.completedLevels
          : [...prev.completedLevels, project.levelRequired],
      };
    });
  }, [pushNotification, awardXP]);

  const trackComponentPlaced = useCallback(() => {
    setState(prev => {
      const total = prev.totalComponentsPlaced + 1;
      // Milestone XP
      if (total === 5) setTimeout(() => awardXP(25, 'Placed 5 components'), 0);
      if (total === 20) setTimeout(() => awardXP(50, 'Placed 20 components'), 0);
      if (total === 50) setTimeout(() => awardXP(100, 'Placed 50 components'), 0);
      return { ...prev, totalComponentsPlaced: total };
    });
  }, [awardXP]);

  const trackWireDrawn = useCallback(() => {
    setState(prev => {
      const total = prev.totalWiresDrawn + 1;
      if (total === 10) setTimeout(() => awardXP(25, 'Drew 10 wires'), 0);
      if (total === 50) setTimeout(() => awardXP(75, 'Drew 50 wires'), 0);
      return { ...prev, totalWiresDrawn: total };
    });
  }, [awardXP]);

  const trackSimulationRun = useCallback(() => {
    setState(prev => {
      const total = prev.totalSimulationsRun + 1;
      if (total === 1) setTimeout(() => awardXP(50, 'Ran first simulation!'), 0);
      if (total === 10) setTimeout(() => awardXP(100, 'Ran 10 simulations'), 0);
      return { ...prev, totalSimulationsRun: total };
    });
  }, [awardXP]);

  // ── Unlock check helpers (simulator component palette) ─────────────────────
  const isUnlocked = useCallback((componentType) => {
    return isComponentUnlocked(componentType, state.currentLevel);
  }, [state.currentLevel]);

  const unlockedSet = getUnlockedComponents(state.currentLevel);

  const resetProgress = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  const nextLevel = LEVELS.find(l => l.id === state.currentLevel + 1);
  const currentLevelData = LEVELS.find(l => l.id === state.currentLevel);
  const xpForNext = nextLevel?.xpRequired ?? null;
  const xpProgress = xpForNext
    ? Math.min(100, Math.round(((state.xp - (currentLevelData?.xpRequired ?? 0)) / (xpForNext - (currentLevelData?.xpRequired ?? 0))) * 100))
    : 100;

  return (
    <GamificationContext.Provider value={{
      // State
      xp: state.xp,
      currentLevel: state.currentLevel,
      earnedBadges: state.earnedBadges,
      completedLevels: state.completedLevels,
      completedProjects: state.completedProjects || [],
      totalComponentsPlaced: state.totalComponentsPlaced,
      totalWiresDrawn: state.totalWiresDrawn,
      totalSimulationsRun: state.totalSimulationsRun,
      coins: state.coins,
      unlockedComponents: state.unlockedComponents,
      componentXP: state.componentXP || 0,
      // Derived
      currentLevelData,
      nextLevel,
      xpProgress,
      unlockedSet,
      // Actions
      awardXP,
      completeLevel,
      completeProject,
      unlockComponent,          
      trackComponentPlaced,
      trackWireDrawn,
      trackSimulationRun,
      isUnlocked,
      resetProgress,
      // Notifications
      notifications,
      dismissNotification,
    }}>
      {children}
    </GamificationContext.Provider>
  );
}