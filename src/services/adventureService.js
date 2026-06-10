import {
  getAdventureUnlocks,
  getGlobalAdventureConfig,
  getMyClassAdventureProgress,
  getResolvedClassAdventure,
  postClassAdventureProgressEvent,
} from "./classAdventureService";
import { fetchUserUnlocks } from "./gamification/unlockService";
import {
  buildFallbackClassAdventureContent,
  getProjectContentBySlug,
  normalizeAdventureContent,
} from "./classAdventureAdapter";

const getProgressStorageKey = (projectSlug) => `adventureProgress:${projectSlug}`;

/** Boards / infrastructure always placeable in adventure/class simulator mode. */
const BASELINE_SIMULATOR_COMPONENT_IDS = new Set([
  "arduino-uno",
  "uno",
  "arduino-mega",
  "mega",
  "arduino-nano",
  "nano",
  "attiny85",
  "raspberry-pi-pico",
  "pico",
  "raspberry-pi-pico-w",
  "pico-w",
  "breadboard",
  "breadboard-half",
  "breadboard-mini",
  "power-supply",
  "battery",
  "charger",
]);

export const normalizeComponentTypeId = (type) =>
  String(type || "")
    .replace(/^openhw-/, "")
    .replace(/^wokwi-/, "");

export const buildUnlockedComponentSet = (unlockedComponents, includeBaseline = true) => {
  if (unlockedComponents == null) return null;
  if (unlockedComponents.includes("*")) return "*";

  const set = includeBaseline ? new Set(BASELINE_SIMULATOR_COMPONENT_IDS) : new Set();
  for (const type of unlockedComponents) {
    const raw = String(type || "").trim();
    if (!raw) continue;
    set.add(raw);
    set.add(normalizeComponentTypeId(raw));
  }
  return set;
};

export const isComponentTypeUnlocked = (itemType, unlockedSet) => {
  if (unlockedSet == null) return false;
  if (unlockedSet === "*") return true;

  const normalized = normalizeComponentTypeId(itemType);
  if (BASELINE_SIMULATOR_COMPONENT_IDS.has(normalized)) return true;

  return unlockedSet.has(itemType) || unlockedSet.has(normalized);
};

export const getAdventureContent = async (classId) => {
  const response = classId
    ? await getResolvedClassAdventure(classId)
    : await getGlobalAdventureConfig();
  const resolved = normalizeAdventureContent(
    response?.resolved || buildFallbackClassAdventureContent(),
  );
  return { resolved, raw: response };
};

export const getAdventureProjectContent = async (classId, projectSlug) => {
  const { resolved, raw } = await getAdventureContent(classId);
  return {
    project: getProjectContentBySlug(resolved, projectSlug),
    resolved,
    raw,
  };
};

/** Minimal display fields for custom (non-PROJECTS) adventure projects. */
export const toProjectDisplayMeta = (project) => {
  if (!project) return null;
  return {
    slug: project.slug,
    id: project.id,
    title: project.title,
    color: project.color || "#3b82f6",
    xpReward: project.xpReward || 100,
  };
};

export const getAdventureProgress = async (classId) => {
  if (!classId) return { progress: null };
  const response = await getMyClassAdventureProgress(classId);
  return { progress: response?.progress || null, raw: response };
};

export const getLocalAdventureStepProgress = (projectSlug) => {
  try {
    const raw = localStorage.getItem(getProgressStorageKey(projectSlug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const markAdventureStepComplete = async ({
  classId,
  projectSlug,
  stepKey,
  stepOrder,
}) => {
  if (classId) {
    await postClassAdventureProgressEvent(classId, {
      eventType: "STEP_COMPLETED",
      projectSlug,
      payload: { stepKey, stepOrder },
    });
  }

  const progress = getLocalAdventureStepProgress(projectSlug) || {
    currentStepOrder: 1,
    completedSteps: [],
  };
  const completedSteps = new Set(progress.completedSteps || []);
  completedSteps.add(`${projectSlug}:${stepKey}`);
  const nextOrder = Math.max(progress.currentStepOrder || 1, stepOrder + 1);

  localStorage.setItem(
    getProgressStorageKey(projectSlug),
    JSON.stringify({
      currentStepOrder: nextOrder,
      completedSteps: Array.from(completedSteps),
    }),
  );

  return {
    currentStepOrder: nextOrder,
    completedSteps: Array.from(completedSteps),
  };
};

export const postAdventureProgressEvent = async (classId, eventPayload) => {
  if (!classId) return null;
  return postClassAdventureProgressEvent(classId, eventPayload);
};

export const postQuizSubmitted = async (classId, projectSlug, { score, passed }) => {
  if (!classId) return null;
  return postAdventureProgressEvent(classId, {
    eventType: "QUIZ_SUBMITTED",
    projectSlug,
    payload: { score, passed },
  });
};

export const postProjectCompleted = async (classId, projectSlug, { xpEarned } = {}) => {
  if (!classId) return null;
  return postAdventureProgressEvent(classId, {
    eventType: "PROJECT_COMPLETED",
    projectSlug,
    payload: { xpEarned: xpEarned ?? 0 },
  });
};

export const getUserUnlockedComponents = async ({ classId, userId } = {}) => {
  if (classId) {
    const response = await getAdventureUnlocks(classId);
    return Array.isArray(response?.unlockedComponents)
      ? response.unlockedComponents
      : [];
  }

  if (userId) {
    const response = await fetchUserUnlocks(userId);
    return Array.isArray(response?.unlockedComponentTypes)
      ? response.unlockedComponentTypes
      : [];
  }

  return [];
};
