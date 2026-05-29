import { PROJECTS } from "./gamification/ProjectsConfig";
import { getProjectFlashcards, getUnlockComponents } from "./gamification/ProjectData";

// ── Helper: Generate guided steps from evaluation criteria (fallback when guidedSteps not in DB) ──
const generateStepsFromEvaluation = (projectSlug, config) => {
  if (!config) return [];

  const steps = [];
  let id = 0;

  const evalCriteria = config?.evaluationCriteria || {};

  // Phase 1: Single step to place ALL required components (as bullet list)
  const requiredComponents = evalCriteria?.components?.required || [];
  const componentBullets = requiredComponents.map(c => `• ${c.count}x ${c.type}\n`).join('');
  if (requiredComponents.length > 0) {
    steps.push({
      id: id++,
      phase: 'wire',
      icon: '🟩',
      color: '#22c55e',
      title: 'Place Components',
      instruction: `Place the following components on the canvas:\n${componentBullets}`,
      tip: 'Components are the building blocks - place them before wiring!',
    });
  }

  // Phase 1 (continued): Single step for ALL wiring connections (as numbered list)
  const requiredConnections = evalCriteria?.wiringAccuracy?.requiredConnections || [];
  const connectionBullets = requiredConnections.map((conn, idx) => {
    const fromLabel = conn.from?.pin || conn.from?.terminal || conn.from?.component;
    const toLabel = conn.to?.pin || conn.to?.terminal || conn.to?.component;
    return `${idx + 1}. ${fromLabel} on ${conn.from?.component} → ${toLabel} on ${conn.to?.component}\n`;
  }).join('');
  if (requiredConnections.length > 0) {
    steps.push({
      id: id++,
      phase: 'wire',
      icon: '〰️',
      color: '#22c55e',
      title: 'Wire Connections',
      instruction: `Make the following connections:\n${connectionBullets}`,
      tip: 'Ensure all wires are properly connected before proceeding to code.',
    });
  }

  // Phase 2: Code step if required
  const codeCfg = evalCriteria?.codeFunctionality;
  if (codeCfg?.requiredFunctions?.length || codeCfg?.expectedBehavior) {
    const funcs = codeCfg?.requiredFunctions?.length
      ? codeCfg.requiredFunctions.map(f => `• ${f}()\n`).join('')
      : '• Write your Arduino sketch\n';
    const starterCode = PROJECTS.find(p => p.slug === projectSlug)?.starterCode || '';
    steps.push({
      id: id++,
      phase: 'code',
      icon: '💻',
      color: '#3b82f6',
      title: 'Write the Code',
      instruction: `Implement the following functions:\n${funcs}`,
      tip: 'Make sure to upload your code after writing it!',
      code: starterCode,
    });
  }

  // Phase 3: Run step
  steps.push({
    id: id++,
    phase: 'run',
    icon: '▶️',
    color: '#f59e0b',
    title: 'Run the Simulation',
    instruction: 'Click the Run button to test your circuit. Verify everything works as expected!',
    tip: 'If your circuit doesn\'t work, double-check your wiring and code.',
  });

  return steps;
};

const buildBaseAdventureProject = (project, index) => {
  const flashcards = getProjectFlashcards(project.slug) || [];
  const quizQuestions = flashcards.map((card, cardIndex) => ({
    id: `q-${card.id || cardIndex + 1}`,
    question: card.quiz?.question || card.front || "",
    options: card.quiz?.options || [],
    correctAnswer: Number.isFinite(card.quiz?.correctAnswer) ? Number(card.quiz.correctAnswer) : 0,
    explanation: card.detail || "",
  }));

  return {
    id: project.id || project.slug,
    slug: project.slug,
    worldId: `world-${project.world || 1}`,
    order: Number(project.number || index + 1),
    enabled: true,
    title: project.title,
    subtitle: project.subtitle || "",
    description: project.description || "",
    prerequisite: project.prerequisite || null,
    xpReward: project.xpReward || 0,
    rewardComponents: getUnlockComponents(project.slug),
    theory: flashcards,
    quizQuestions,
    assessment: project.evaluation || {},
  };
};

const mergeWorldsWithFallback = (contentWorlds = [], fallbackWorlds = []) => {
  const fallbackById = new Map(fallbackWorlds.map((world) => [world.id, world]));
  const merged = contentWorlds.map((world, index) => {
    const base = fallbackById.get(world.id);
    return {
      ...base,
      ...world,
      id: world.id || base?.id || `world-${index + 1}`,
      title: world.title || base?.title || `World ${index + 1}`,
      theme: world.theme ?? base?.theme ?? "",
      color: world.color || base?.color || "#3b82f6",
      icon: world.icon || base?.icon || "🧭",
      order: Number.isFinite(world.order) ? world.order : Number(base?.order || index + 1),
    };
  });

  const existingIds = new Set(merged.map((world) => world.id));
  fallbackWorlds.forEach((world) => {
    if (!existingIds.has(world.id)) {
      merged.push(world);
    }
  });

  return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
};

const mergeProjectsWithFallback = (contentProjects = [], fallbackProjects = []) => {
  const projectBySlug = new Map(contentProjects.map((project) => [project.slug, project]));
  const merged = fallbackProjects.map((baseProject) => {
    const existing = projectBySlug.get(baseProject.slug);
    if (!existing) return baseProject;

    return {
      ...baseProject,
      ...existing,
      id: existing.id || baseProject.id,
      slug: baseProject.slug,
      worldId: existing.worldId || baseProject.worldId,
      order: Number.isFinite(existing.order) ? existing.order : baseProject.order,
      enabled: existing.enabled ?? baseProject.enabled,
      title: existing.title || baseProject.title,
      subtitle: existing.subtitle ?? baseProject.subtitle,
      description: existing.description ?? baseProject.description,
      prerequisite: existing.prerequisite ?? baseProject.prerequisite,
      xpReward: Number.isFinite(existing.xpReward) ? existing.xpReward : baseProject.xpReward,
      theory: Array.isArray(existing.theory) && existing.theory.length ? existing.theory : baseProject.theory,
      quizQuestions: Array.isArray(existing.quizQuestions) && existing.quizQuestions.length ? existing.quizQuestions : baseProject.quizQuestions,
      rewardComponents: Array.isArray(existing.rewardComponents) && existing.rewardComponents.length ? existing.rewardComponents : baseProject.rewardComponents,
      assessment: {
        ...baseProject.assessment,
        ...(existing.assessment || {}),
        passingThreshold:
          Number.isFinite(existing.assessment?.passingThreshold)
            ? existing.assessment.passingThreshold
            : baseProject.assessment?.passingThreshold ?? 60,
        evaluationCriteria:
          existing.assessment?.evaluationCriteria ?? baseProject.assessment?.evaluationCriteria ?? {},
      },
    };
  });

  const knownSlugs = new Set(merged.map((project) => project.slug));
  contentProjects.forEach((project) => {
    if (!knownSlugs.has(project.slug)) {
      merged.push(project);
    }
  });

  return merged.sort((a, b) => (a.order || 0) - (b.order || 0));
};

export const buildFallbackClassAdventureContent = () => {
  const worldsMap = new Map();
  const projects = PROJECTS.map((project, index) => {
    const baseProject = buildBaseAdventureProject(project, index);
    const worldId = `world-${project.world || 1}`;
    if (!worldsMap.has(worldId)) {
      worldsMap.set(worldId, {
        id: worldId,
        title: `World ${project.world || 1}`,
        theme: project.difficultyLabel || "",
        color: project.color || "",
        icon: project.icon || "",
        order: Number(project.world || 1),
      });
    }
    return baseProject;
  });
  return {
    worlds: [...worldsMap.values()].sort((a, b) => a.order - b.order),
    projects,
    version: 1,
  };
};

export const normalizeAdventureContent = (content) => {
  const fallback = buildFallbackClassAdventureContent();
  if (!content) return fallback;

  const fallbackWorlds = fallback.worlds || [];
  const fallbackProjects = fallback.projects || [];
  const worlds = mergeWorldsWithFallback(content.worlds || [], fallbackWorlds);
  const projects = mergeProjectsWithFallback(content.projects || [], fallbackProjects);

  return {
    ...fallback,
    ...content,
    worlds,
    projects,
    version: Number.isFinite(content.version) ? content.version : fallback.version,
  };
};

// ── Helper: Get guided steps for a project (DB steps or derived from evaluation) ──
export const getProjectGuidedSteps = (project, projectSlug) => {
  // Use DB-provided steps if available
  if (project?.guidedSteps?.length > 0) {
    return project.guidedSteps;
  }
  // Fall back to deriving from evaluation criteria (from either DB or built-in PROJECTS)
  const assessment = project?.assessment || PROJECTS.find(p => p.slug === projectSlug)?.evaluation || {};
  return generateStepsFromEvaluation(projectSlug, assessment);
};

export const getProjectContentBySlug = (content, slug) =>
  (content?.projects || []).find((project) => project.slug === slug) || null;

// ── Helper: Convert ProjectBank entry to adventure project format ──
export const projectBankToAdventureProject = (bankProject, index) => {
  return {
    id: bankProject._id || bankProject.slug,
    slug: bankProject.slug,
    worldId: `world-${bankProject.world || 1}`,
    order: bankProject.order || index + 1,
    enabled: bankProject.enabled !== false,
    title: bankProject.title,
    subtitle: bankProject.subtitle || "",
    description: bankProject.description || "",
    prerequisite: bankProject.prerequisite || null,
    xpReward: bankProject.xpReward || 0,
    rewardComponents: bankProject.rewardComponents || [],
    theory: bankProject.theory || [],
    quizQuestions: bankProject.quizQuestions || [],
    guidedSteps: bankProject.guidedSteps || [],
    assessment: bankProject.assessment || {},
    components: bankProject.components || [],
    starterCode: bankProject.starterCode || "",
  };
};

// ── Helper: Fetch projects from ProjectBank and merge with fallback ──
export const fetchProjectBankProjects = async () => {
  try {
    const sharedResponse = await fetch(`${(import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? "http://localhost:5001/api" : "/api"))}/project-bank/shared`);
    if (!sharedResponse.ok) return [];
    const data = await sharedResponse.json();
    return (data.projects || []).map((p, i) => projectBankToAdventureProject(p, i));
  } catch (e) {
    console.warn("Failed to fetch shared project bank:", e);
    return [];
  }
};

