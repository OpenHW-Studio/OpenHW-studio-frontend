import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, isComponentUnlocked } from '../services/gamification/GamificationConfig.jsx';
import { PROJECTS, getProjectStatus } from '../services/gamification/ProjectsConfig.js';
import { useAuth } from './AuthContext.jsx';
import {
  fetchUserUnlocks,
  saveUserUnlocks,
  saveProjectComplete,
  fetchCompletedProjects,
} from '../services/gamification/unlockService';

const getStorageKey = (email) => `openhw_gamification_v3_${email || 'guest'}`;

// Components every user always has from level 1
const ALWAYS_UNLOCKED = ['openhw-arduino-uno', 'openhw-led', 'openhw-resistor'];

// Get all level-based unlocks for a given level id
const getLevelUnlocks = (levelId) => {
  const level = LEVELS.find(l => l.id === levelId);
  return level?.unlockedComponents || [];
};

// Merge arrays + ALWAYS_UNLOCKED into a deduplicated array
const mergeUnlocks = (...arrays) => {
  const set = new Set([...ALWAYS_UNLOCKED]);
  for (const arr of arrays) {
    if (Array.isArray(arr)) arr.filter(Boolean).forEach(t => set.add(t));
  }
  return Array.from(set);
};

const DEFAULT_STATE = {
  xp: 0,
  currentLevel: 1,
  earnedBadges: [],
  completedLevels: [],
  completedProjects: [],
  unlockedComponentTypes: mergeUnlocks(getLevelUnlocks(1)),
  totalComponentsPlaced: 0,
  totalWiresDrawn: 0,
  totalSimulationsRun: 0,
  coins: 0,
};

const GamificationContext = createContext(null);

const DEFAULT_CONTEXT = {
  xp: 0,
  currentLevel: 1,
  earnedBadges: [],
  completedLevels: [],
  completedProjects: [],
  totalComponentsPlaced: 0,
  totalWiresDrawn: 0,
  totalSimulationsRun: 0,
  coins: 0,
  unlockedComponentTypes: [...ALWAYS_UNLOCKED],
  currentLevelData: null,
  nextLevel: null,
  xpProgress: 0,
  trackComponentPlaced: () => {},
  trackWireDrawn: () => {},
  trackSimulationRun: () => {},
  isUnlocked: () => false,
  isProjectUnlocked: () => false,
  awardXP: () => {},
  completeProject: () => {},
  resetProgress: () => {},
  unlockComponentTypes: async () => {},
  notifications: [],
  dismissNotification: () => {},
};

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) return DEFAULT_CONTEXT;
  return ctx;
}

// Simple debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  const debounced = (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
};

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = getStorageKey(user?.email);

  const [state, setState] = useState(DEFAULT_STATE);

  // ── Load from backend + localStorage on mount / user change ─────────────────
  useEffect(() => {
    const loadGamificationData = async () => {
      try {
        // Start from defaults
        let parsed = { ...DEFAULT_STATE };

        // Pull localStorage as a fast-load baseline (non-blocking)
        try {
          const stored = localStorage.getItem(storageKey)
            || localStorage.getItem(getStorageKey(null));
          if (stored) {
            parsed = { ...DEFAULT_STATE, ...JSON.parse(stored) };
          }
        } catch {
          // ignore parse errors
        }

        if (user?.email && (user._id || user.id)) {
          // Fetch unlocks AND completed projects from MongoDB in parallel
          const [unlockData, completedFromServer] = await Promise.all([
            fetchUserUnlocks(user._id || user.id).catch(() => ({ unlockedComponentTypes: [] })),
            fetchCompletedProjects().catch(() => []),
          ]);

          // Merge server unlocks with level-1 defaults and ALWAYS_UNLOCKED
          const levelUnlocks = getLevelUnlocks(1);
          parsed.unlockedComponentTypes = mergeUnlocks(
            unlockData.unlockedComponentTypes,
            levelUnlocks,
            // Also re-derive unlocks from completed projects (in case server unlocks are partial)
            ...completedFromServer.map(slug => {
              const proj = PROJECTS.find(p => p.slug === slug);
              return (proj?.rewardComponents || []).map(r => r.type).filter(Boolean);
            })
          );

          // Merge completed projects (server is source of truth, local fills gaps)
          const localCompleted = Array.isArray(parsed.completedProjects) ? parsed.completedProjects : [];
          const mergedCompleted = Array.from(new Set([...completedFromServer, ...localCompleted]));
          parsed.completedProjects = mergedCompleted;
        } else {
          // Not logged in — use level defaults
          parsed.unlockedComponentTypes = mergeUnlocks(getLevelUnlocks(1));
        }

        // Final safety: always ensure ALWAYS_UNLOCKED are present
        if (parsed.unlockedComponentTypes !== '*') {
          parsed.unlockedComponentTypes = mergeUnlocks(parsed.unlockedComponentTypes);
        }

        setState(parsed);

        // Persist merged state back to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(parsed));
        } catch {
          // ignore
        }
      } catch (e) {
        console.warn('Failed to load gamification data, using defaults:', e);
        setState(DEFAULT_STATE);
      }
    };

    loadGamificationData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, user]);

  // ── Debounced save of unlocks to MongoDB ─────────────────────────────────────
  useEffect(() => {
    const handleSave = async () => {
      try {
        if (user?.email && (user._id || user.id) && state.unlockedComponentTypes !== '*') {
          await saveUserUnlocks(user._id || user.id, state.unlockedComponentTypes);
        }
        // Always mirror to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(state));
        } catch {
          // ignore
        }
      } catch (e) {
        console.warn('Failed to save gamification data to MongoDB:', e);
      }
    };

    const debouncedSave = debounce(handleSave, 2000);
    debouncedSave();
    return () => debouncedSave.cancel();
  }, [state, user, storageKey]);

  // ── Notifications ────────────────────────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);

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

  // ── awardXP ──────────────────────────────────────────────────────────────────
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

  // ── unlockComponentTypes ─────────────────────────────────────────────────────
  const unlockComponentTypes = useCallback(async (typesToUnlock) => {
    setState(prev => {
      if (prev.unlockedComponentTypes === '*' || typesToUnlock.includes('*')) {
        // Wildcard — no per-component save needed
        return { ...prev, unlockedComponentTypes: '*' };
      }

      const currentSet = new Set(
        Array.isArray(prev.unlockedComponentTypes) ? prev.unlockedComponentTypes : ALWAYS_UNLOCKED
      );
      typesToUnlock.filter(Boolean).map(String).forEach(t => currentSet.add(t));
      // Always keep ALWAYS_UNLOCKED
      ALWAYS_UNLOCKED.forEach(t => currentSet.add(t));

      const finalUnlocks = Array.from(currentSet);

      // Persist to MongoDB (non-blocking — saveUserUnlocks only POSTs new items)
      if (user?.email && (user._id || user.id)) {
        saveUserUnlocks(user._id || user.id, finalUnlocks).catch(e =>
          console.warn('Failed to save unlocks to MongoDB:', e)
        );
      }

      return { ...prev, unlockedComponentTypes: finalUnlocks };
    });
  }, [user]);

  // ── completeProject ───────────────────────────────────────────────────────────
  const completeProject = useCallback((projectSlug) => {
    setState(prev => {
      const alreadyDone = prev.completedProjects?.includes(projectSlug);

      if (alreadyDone) {
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
      const newCompletedProjects = [...(prev.completedProjects || []), projectSlug];

      // ── Persist project completion to backend ──────────────────────────────
      saveProjectComplete(projectSlug, xpGain, project.badge?.id || null).catch(e =>
        console.warn('Failed to sync project completion to backend:', e)
      );

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
        completedLevels: prev.completedLevels.includes(project.levelRequired)
          ? prev.completedLevels
          : [...prev.completedLevels, ...(project.levelRequired ? [project.levelRequired] : [])],
      };
    });
  }, [pushNotification, awardXP]);

  // ── Activity trackers ────────────────────────────────────────────────────────
  const trackComponentPlaced = useCallback(() => {
    setState(prev => {
      const total = prev.totalComponentsPlaced + 1;
      if (total === 5)  setTimeout(() => awardXP(25,  'Placed 5 components'),  0);
      if (total === 20) setTimeout(() => awardXP(50,  'Placed 20 components'), 0);
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
      if (total === 1)  setTimeout(() => awardXP(50,  'Ran first simulation!'), 0);
      if (total === 10) setTimeout(() => awardXP(100, 'Ran 10 simulations'),    0);
      return { ...prev, totalSimulationsRun: total };
    });
  }, [awardXP]);

  // ── isUnlocked ───────────────────────────────────────────────────────────────
  // Accepts both 'openhw-led' and 'wokwi-led' forms
  const isUnlocked = useCallback((componentType) => {
    if (!componentType) return false;
    if (state.unlockedComponentTypes === '*') return true;

    const types = Array.isArray(state.unlockedComponentTypes)
      ? state.unlockedComponentTypes
      : ALWAYS_UNLOCKED;

    // Direct match
    if (types.includes(componentType)) return true;

    // Cross-prefix match: 'openhw-led' ↔ 'wokwi-led'
    const alt = componentType.startsWith('openhw-')
      ? `wokwi-${componentType.slice(7)}`
      : componentType.startsWith('wokwi-')
        ? `openhw-${componentType.slice(6)}`
        : null;
    if (alt && types.includes(alt)) return true;

    // Fallback: use isComponentUnlocked from GamificationConfig for level-based checks
    return isComponentUnlocked(componentType, types, state.currentLevel);
  }, [state.unlockedComponentTypes, state.currentLevel]);

  // ── isProjectUnlocked ────────────────────────────────────────────────────────
  const isProjectUnlocked = useCallback((projectSlug) => {
    const status = getProjectStatus(projectSlug, state.completedProjects || []);
    return status !== 'locked';
  }, [state.completedProjects]);

  // ── resetProgress ────────────────────────────────────────────────────────────
  const resetProgress = useCallback(() => {
    const fresh = { ...DEFAULT_STATE, unlockedComponentTypes: [...ALWAYS_UNLOCKED] };
    setState(fresh);
    try { localStorage.setItem(storageKey, JSON.stringify(fresh)); } catch { /* ignore */ }

    if (user?.email && (user._id || user.id)) {
      saveUserUnlocks(user._id || user.id, [...ALWAYS_UNLOCKED]).catch(e =>
        console.warn('Failed to reset unlocks in MongoDB:', e)
      );
    }
  }, [user, storageKey]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const nextLevel = LEVELS.find(l => l.id === state.currentLevel + 1);
  const currentLevelData = LEVELS.find(l => l.id === state.currentLevel);
  const xpForNext = nextLevel?.xpRequired ?? null;
  const xpProgress = xpForNext
    ? Math.min(100, Math.round(
        ((state.xp - (currentLevelData?.xpRequired ?? 0)) /
         (xpForNext - (currentLevelData?.xpRequired ?? 0))) * 100
      ))
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
      unlockComponentTypes,
      // Notifications
      notifications,
      dismissNotification,
      // Legacy compat
      unlockedComponents: state.unlockedComponentTypes,
      unlockedSet: state.unlockedComponentTypes === '*'
        ? '*'
        : new Set(Array.isArray(state.unlockedComponentTypes)
            ? state.unlockedComponentTypes
            : ALWAYS_UNLOCKED),
    }}>
      {children}
    </GamificationContext.Provider>
  );
}
