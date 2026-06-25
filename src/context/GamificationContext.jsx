import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, isComponentUnlocked } from '../services/gamification/GamificationConfig.jsx';
import { PROJECTS, getProjectStatus } from '../services/gamification/ProjectsConfig.js';
import { useAuth } from './AuthContext.jsx';
import { fetchUserGamificationState, saveUserGamificationState } from '../services/gamification/unlockService';

const getStorageKey = (email) => `openhw_gamification_v3_${email || 'guest'}`;
const STARTING_COMPONENTS = [];

// Get all level-based unlocks for initial level
const getLevelUnlocks = (levelId) => {
  let unlocks = [];
  for (const level of LEVELS) {
    if (level.id <= levelId && level.unlockedComponents) {
      unlocks.push(...level.unlockedComponents);
    }
  }
  return unlocks;
};

const DEFAULT_STATE = {
  xp: 0,
  currentLevel: 1,
  earnedBadges: [],
  completedLevels: [],
  completedProjects: [],
  // unlockedComponentTypes: array of openhw-type strings, or '*' for all
  // At level 1, user gets level 1 unlocks automatically
  unlockedComponentTypes: [...STARTING_COMPONENTS, ...getLevelUnlocks(1)],
  totalComponentsPlaced: 0,
  totalWiresDrawn: 0,
  totalSimulationsRun: 0,
  coins: 0,
};

const GamificationContext = createContext(null);

// Default context values for when used outside provider (e.g., standalone simulator)
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
  unlockedComponentTypes: [],
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
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
  debounced.cancel = () => clearTimeout(timeoutId);
  return debounced;
};

export function GamificationProvider({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const storageKey = getStorageKey(user?.email);

  const [state, setState] = useState(DEFAULT_STATE);

  // Fetch unlocks from MongoDB on init and whenever user changes
  useEffect(() => {
    const loadGamificationData = async () => {
      try {
        // Start with default state
        let parsed = { ...DEFAULT_STATE };
        
        // If we have local storage data (migration), use it as base
        try {
          let stored = localStorage.getItem(storageKey);
          if (!stored && storageKey !== getStorageKey(null)) {
            stored = localStorage.getItem(getStorageKey(null));
          }
          if (stored) {
            parsed = { ...DEFAULT_STATE, ...JSON.parse(stored) };
          }
        } catch (e) {
          // Ignore parsing errors, use defaults
        }

        // Self-heal: Infer completed projects and recalculate XP/Level
        try {
          const inferred = [];
          
          for (const p of PROJECTS) {
            try {
              const raw = localStorage.getItem(`adventureProgress:${p.slug}`);
              if (raw) {
                const parsedProgress = JSON.parse(raw);
                const order = parsedProgress.currentStepOrder;
                const completedSteps = parsedProgress.completedSteps || [];
                if (order > 4 || completedSteps.includes(`${p.slug}:sim`) || completedSteps.includes('sim')) {
                  inferred.push(p.slug);
                }
              }
            } catch(e){}
          }
          
          if (inferred.length > 0) {
            // Merge inferred projects into parsed state
            const uniqueProjects = Array.from(new Set([...(parsed.completedProjects || []), ...inferred]));
            parsed.completedProjects = uniqueProjects;
            
            // Recalculate XP
            let calculatedXp = 0;
            let calculatedBadges = new Set(parsed.earnedBadges || []);
            for (const slug of uniqueProjects) {
              const proj = PROJECTS.find(p => p.slug === slug);
              if (proj) {
                calculatedXp += proj.xpReward || 100;
                if (proj.badge?.id) calculatedBadges.add(proj.badge.id);
              }
            }
            
            if (calculatedXp > parsed.xp) {
              parsed.xp = calculatedXp;
            }
            parsed.earnedBadges = Array.from(calculatedBadges);
          }
        } catch (e) {
          // Ignore
        }

        // Recalculate level based on XP
        let calculatedLevel = 1;
        for (const l of LEVELS) {
          if (parsed.xp >= l.xpRequired && l.id > calculatedLevel) {
            calculatedLevel = l.id;
          }
        }
        parsed.currentLevel = Math.max(parsed.currentLevel || 1, calculatedLevel);
        
        // Fetch full gamification state from MongoDB if user is authenticated
        if (user?.email && (user._id || user.id)) {
          try {
            const apiData = await fetchUserGamificationState(user._id || user.id);
            if (apiData?.state && Object.keys(apiData.state).length > 0) {
              const backendState = apiData.state;
              if (backendState.xp > parsed.xp) parsed.xp = backendState.xp;
              if (backendState.currentLevel > parsed.currentLevel) parsed.currentLevel = backendState.currentLevel;
              
              if (backendState.completedProjects && backendState.completedProjects.length > 0) {
                const mergedProjects = new Set([...parsed.completedProjects, ...backendState.completedProjects]);
                parsed.completedProjects = Array.from(mergedProjects);
              }
              if (backendState.earnedBadges && backendState.earnedBadges.length > 0) {
                const mergedBadges = new Set([...parsed.earnedBadges, ...backendState.earnedBadges]);
                parsed.earnedBadges = Array.from(mergedBadges);
              }
              
              const levelUnlocks = getLevelUnlocks(parsed.currentLevel || 1);
              let backendUnlocks = backendState.unlockedComponentTypes || [];
              if (backendUnlocks === '*') {
                parsed.unlockedComponentTypes = '*';
              } else {
                const combinedUnlocks = [...backendUnlocks, ...levelUnlocks];
                const uniqueUnlocks = Array.from(new Set(combinedUnlocks));
                parsed.unlockedComponentTypes = uniqueUnlocks.length > 0 ? uniqueUnlocks : [...STARTING_COMPONENTS, ...levelUnlocks];
              }
            } else {
              // No backend data yet, use level-based unlocks
              parsed.unlockedComponentTypes = [...STARTING_COMPONENTS, ...getLevelUnlocks(parsed.currentLevel || 1)];
            }
          } catch (e) {
            console.warn('Failed to fetch user gamification state from MongoDB, using level defaults:', e);
            // Fall back to level-based unlocks
            parsed.unlockedComponentTypes = [...STARTING_COMPONENTS, ...getLevelUnlocks(parsed.currentLevel || 1)];
          }
        } else {
          // No user, use level-based unlocks
          parsed.unlockedComponentTypes = [...STARTING_COMPONENTS, ...getLevelUnlocks(parsed.currentLevel || 1)];
        }
        
        // Always ensure starting components are present
        if (parsed.unlockedComponentTypes !== '*' && Array.isArray(parsed.unlockedComponentTypes)) {
          const set = new Set([...STARTING_COMPONENTS, ...parsed.unlockedComponentTypes]);
          parsed.unlockedComponentTypes = [...set];
        }
        
        setState(parsed);
      } catch (e) {
        console.warn('Failed to load gamification data, using defaults:', e);
        setState(DEFAULT_STATE);
      }
    };
    
    loadGamificationData();
  }, [storageKey, user]);

  // Save to MongoDB on state changes (debounced)
  useEffect(() => {
    const handleSave = async () => {
      try {
        if (user?.email && (user._id || user.id)) {
          await saveUserGamificationState(user._id || user.id, state);
          
          // Also save to localStorage as backup/migration
          try {
            localStorage.setItem(storageKey, JSON.stringify(state));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
        } else {
          // Guest mode: Just save to localStorage
          try {
            localStorage.setItem(storageKey, JSON.stringify(state));
          } catch (e) {
            console.warn('Failed to save to localStorage:', e);
          }
        }
      } catch (e) {
        console.warn('Failed to save gamification data to MongoDB:', e);
      }
    };
    
    const debouncedSave = debounce(handleSave, 3000);
    debouncedSave();
    
    return () => debouncedSave.cancel();
  }, [state, user, storageKey]);

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

  // ── Unlock Component Types ─────────────────────────────────────────────────────
  const unlockComponentTypes = useCallback(async (typesToUnlock) => {
    console.log('DEBUG: Context receiving manual unlocks:', typesToUnlock);
    // Update local state and persist to MongoDB
    setState(prev => {
      // Handle wildcard case
      if (prev.unlockedComponentTypes === '*' || typesToUnlock.includes('*')) {
        if (user?.email && (user._id || user.id)) {
          saveUserGamificationState(user._id || user.id, { ...prev, unlockedComponentTypes: '*' }).catch(e =>
            console.warn('Failed to save unlocks to MongoDB:', e)
          );
        }
        return { ...prev, unlockedComponentTypes: '*' };
      }

      // Convert current state to set for easy manipulation
      const currentSet = prev.unlockedComponentTypes === '*'
        ? new Set()
        : new Set(prev.unlockedComponentTypes);

      // Add new types to the set (ensuring they are strings)
      typesToUnlock
        .filter(Boolean)
        .map(String)
        .forEach(type => currentSet.add(type));

      const finalUnlocks = Array.from(currentSet);
      console.log('DEBUG: Final merged unlocks:', finalUnlocks);

      // Persist to MongoDB with the correct new state
      if (user?.email && (user._id || user.id)) {
        saveUserGamificationState(user._id || user.id, { ...prev, unlockedComponentTypes: finalUnlocks }).catch(e =>
          console.warn('Failed to save unlocks to MongoDB:', e)
        );
      }

      return { ...prev, unlockedComponentTypes: finalUnlocks };
    });
  }, [user]);

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
      const newCompletedProjects = [...(prev.completedProjects || []), projectSlug];

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

  // ── isUnlocked: checks unlockedComponentTypes in state AND level-based unlocks ────────────────────
  const isUnlocked = useCallback((componentType) => {
    // Check project-unlocked components (includes level-based via isComponentUnlocked)
    const result = isComponentUnlocked(componentType, state.unlockedComponentTypes, state.currentLevel);
    if (componentType.includes('led')) console.log('DEBUG: Checking LED status:', componentType, 'Result:', result, 'unlockedComponentTypes:', state.unlockedComponentTypes);
    return result;
  }, [state.unlockedComponentTypes, state.currentLevel]);

  // ── isProjectUnlocked: sequential prerequisite chain ─────────────────────
  const isProjectUnlocked = useCallback((projectSlug) => {
    const status = getProjectStatus(projectSlug, state.completedProjects || []);
    return status !== 'locked';
  }, [state.completedProjects]);

  const resetProgress = useCallback(() => {
    setState({ ...DEFAULT_STATE, unlockedComponentTypes: [...STARTING_COMPONENTS] });

    // Also reset in MongoDB
    if (user?.email && (user._id || user.id)) {
      saveUserUnlocks(user._id || user.id, [...STARTING_COMPONENTS]).catch(e =>
        console.warn('Failed to reset unlocks in MongoDB:', e)
      );
    }
  }, [user]);

  const nextLevel = LEVELS.find(l => l.id === state.currentLevel + 1);
  const currentLevelData = LEVELS.find(l => l.id === state.currentLevel);
  const xpForNext = nextLevel?.xpRequired ?? null;
  const xpProgress = xpForNext
    ? Math.min(100, Math.round(((state.xp - (currentLevelData?.xpRequired ?? 0)) / (xpForNext - (currentLevelData?.xpRequired ?? 0)) * 100)))
    : 100;

   // #region agent log
   // fetch('http://127.0.0.1:7475/ingest/244e948d-2e16-4c5d-a186-216f4f0cf7f3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b31e6e'},body:JSON.stringify({sessionId:'b31e6e',location:'GamificationContext.jsx:xpProgress',message:'xpProgress computed',data:{xpProgress,xpForNext,xp:state.xp,currentLevel:state.currentLevel},timestamp:Date.now(),hypothesisId:'A',runId:'post-fix'})}).catch(()=>{});
   // #endregion

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
      unlockComponentTypes, // <-- NEW: Function to unlock component types via MongoDB
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