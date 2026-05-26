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

export const buildFallbackClassAdventureContent = () => {
  const worldsMap = new Map();
  const projects = PROJECTS.map((project, index) => {
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
    return {
      id: project.id || project.slug,
      slug: project.slug,
      worldId,
      order: Number(project.number || index + 1),
      enabled: true,
      title: project.title,
      subtitle: project.subtitle || "",
      description: project.description || "",
      prerequisite: project.prerequisite || null,
      xpReward: project.xpReward || 0,
      rewardComponents: getUnlockComponents(project.slug),
      theory: getProjectFlashcards(project.slug),
      quizQuestions: (getProjectFlashcards(project.slug) || []).map((card, cardIndex) => ({
        id: `q-${card.id || cardIndex + 1}`,
        question: card.quiz?.question || card.front,
        options: card.quiz?.options || [],
        correctAnswer: Number.isFinite(card.quiz?.correctAnswer) ? Number(card.quiz.correctAnswer) : 0,
        explanation: card.detail || "",
      })),
      assessment: project.evaluation || {},
    };
  });
  return {
    worlds: [...worldsMap.values()].sort((a, b) => a.order - b.order),
    projects,
    version: 1,
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

