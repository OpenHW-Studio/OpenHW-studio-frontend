import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LEVELS, STARTING_COMPONENTS } from '../services/gamification/GamificationConfig.jsx';
import { PROJECTS, getProjectStatus, getEarnedComponents } from '../services/gamification/ProjectsConfig.js';
import { useAuth } from './AuthContext.jsx';

const getStorageKey = (email) => `openhw_gamification_v3_${email || 'guest'}`;

const DEFAULT_STATE = {
  xp: 0,
  currentLevel: 1,
  earnedBadges: [],
  completedLevels: [],
  completedProjects: [],
  // unlockedComponentTypes: array of wokwi-type strings, or '*' for all
  // Starts with just LED + Resistor + Arduino (given for free on Day 1)
  unlockedComponentTypes: [...STARTING_COMPONENTS],
  totalComponentsPlaced: 0,
  totalWiresDrawn: 0,
  totalSimulationsRun: 0,
  coins: 0,
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
      const stored = localStorage.getItem(getStorageKey(null));
      const parsed = stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
      // Always ensure starting components are present
      if (parsed.unlockedComponentTypes !== '*' && Array.isArray(parsed.unlockedComponentTypes)) {
        const set = new Set([...STARTING_COMPONENTS, ...parsed.unlockedComponentTypes]);
        parsed.unlockedComponentTypes = [...set];
      }
      return parsed;
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const parsed = stored ? { ...DEFAULT_STATE, ...JSON.parse(stored) } : DEFAULT_STATE;
      if (parsed.unlockedComponentTypes !== '*' && Array.isArray(parsed.unlockedComponentTypes)) {
        const set = new Set([...STARTING_COMPONENTS, ...parsed.unlockedComponentTypes]);
        parsed.unlockedComponentTypes = [...set];
      }
      setState(parsed);
    } catch {
      setState(DEFAULT_STATE);
    }
  }, [storageKey]);

  const [notifications, setNotifications] = useState([]);

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
      let newLevel = prev.currentLevel;
      for (const lvl of LEVELS) {
        if (newXP >= lvl.xpRequired && lvl.id > newLevel) newLevel = lvl.id;
      }

      if (newLevel > prev.currentLevel) {
        const lvlData = LEVELS.find(l => l.id === newLevel);
        setTimeout(() => {
          pushNotification({
            type: 'levelup',
            title: `Level ${newLevel} Reached! 🎉`,
            subtitle: lvlData?.title || '',
            icon: lvlData?.icon || '🎉',
            color: lvlData?.color || '#22c55e',
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

  // ── Complete a Project ─────────────────────────────────────────────────────
  // Awards XP, badge, level-up, AND unlocks reward components automatically.
  // NO quiz required — project completion IS the unlock mechanism.
  const completeProject = useCallback((projectSlug) => {
    setState(prev => {
      const alreadyDone = prev.completedProjects?.includes(projectSlug);

      if (alreadyDone) {
        // Re-submission: award 25% bonus XP
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

      // Award project badge
      if (project.badge?.id && !newBadges.includes(project.badge.id)) {
        newBadges.push(project.badge.id);
        setTimeout(() => {
          pushNotification({
            type: 'badge',
            title: 'Badge Earned! 🏅',
            subtitle: project.badge.name,
            description: project.badge.description,
            icon: project.badge.icon,
            rarity: project.badge.rarity,
            color: project.color || '#22c55e',
            duration: 5500,
          });
        }, 300);
      }

      // Unlock reward components
      const newCompletedProjects = [...(prev.completedProjects || []), projectSlug];
      const earnedComponents = getEarnedComponents(newCompletedProjects);

      // Notify about new components earned
      const rewardComponents = project.rewardComponents || [];
      if (rewardComponents.length > 0) {
        setTimeout(() => {
          for (const reward of rewardComponents) {
            if (reward.type === '*') {
              pushNotification({
                type: 'unlock',
                title: '🏆 All Components Unlocked!',
                subtitle: 'You\'re a Circuit Champion! Build anything!',
                icon: '🏆',
                color: '#fbbf24',
                duration: 7000,
              });
            } else {
              pushNotification({
                type: 'unlock',
                title: `🔓 New Component Unlocked!`,
                subtitle: `${reward.icon} ${reward.name}`,
                description: reward.description,
                icon: reward.icon,
                color: '#22c55e',
                duration: 5000,
              });
            }
          }
        }, 800);
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
            title: `Level ${newLevel} Unlocked! 🎉`,
            subtitle: lvlData?.title || '',
            icon: lvlData?.icon || '🎉',
            color: lvlData?.color || '#22c55e',
            duration: 7000,
          });
        }, 1500);
      }

      // XP notification
      setTimeout(() => {
        pushNotification({
          type: 'xp',
          title: `+${xpGain} XP`,
          subtitle: `${project.title} completed! ✅`,
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
        completedProjects: newCompletedProjects,
        // Update unlocked component types from project rewards
        unlockedComponentTypes: earnedComponents === '*' ? '*' : [...(earnedComponents instanceof Set ? earnedComponents : new Set(earnedComponents))],
        completedLevels: prev.completedLevels.includes(project.levelRequired)
          ? prev.completedLevels
          : [...prev.completedLevels, ...(project.levelRequired ? [project.levelRequired] : [])],
      };
    });
  }, [pushNotification, awardXP]);

  const trackComponentPlaced = useCallback(() => {
    setState(prev => {
      const total = prev.totalComponentsPlaced + 1;
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

  // ── isUnlocked: checks unlockedComponentTypes in state ────────────────────
  const isUnlocked = useCallback((componentType) => {
    if (state.unlockedComponentTypes === '*') return true;
    if (Array.isArray(state.unlockedComponentTypes)) {
      return state.unlockedComponentTypes.includes(componentType);
    }
    return STARTING_COMPONENTS.includes(componentType);
  }, [state.unlockedComponentTypes]);

  // ── isProjectUnlocked: sequential prerequisite chain ─────────────────────
  const isProjectUnlocked = useCallback((projectSlug) => {
    const status = getProjectStatus(projectSlug, state.completedProjects || []);
    return status !== 'locked';
  }, [state.completedProjects]);

  const resetProgress = useCallback(() => {
    setState({ ...DEFAULT_STATE, unlockedComponentTypes: [...STARTING_COMPONENTS] });
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
      unlockedComponentTypes: state.unlockedComponentTypes,
      // Derived
      currentLevelData,
      nextLevel,
      xpProgress,
      // Actions
      awardXP,
      completeProject,
      trackComponentPlaced,
      trackWireDrawn,
      trackSimulationRun,
      isUnlocked,
      isProjectUnlocked,
      resetProgress,
      // Notifications
      notifications,
      dismissNotification,
      // Legacy compat
      unlockedComponents: state.unlockedComponentTypes,
      unlockedSet: state.unlockedComponentTypes === '*' ? '*' : new Set(Array.isArray(state.unlockedComponentTypes) ? state.unlockedComponentTypes : STARTING_COMPONENTS),
    }}>
      {children}
    </GamificationContext.Provider>
  );
}
