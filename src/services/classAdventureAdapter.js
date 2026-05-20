import { PROJECTS } from "./gamification/ProjectsConfig";
import { getProjectFlashcards, getUnlockComponents } from "./gamification/ProjectData";

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
        correctAnswer: Number.isFinite(card.quiz?.correctAnswer) ? card.quiz.correctAnswer : 0,
        explanation: card.detail || "",
      })),
      // ── Assessment placed alongside theory/quizQuestions (no nodes array) ──
      assessment: project.evaluation || {},
    };
  });
  return {
    worlds: [...worldsMap.values()].sort((a, b) => a.order - b.order),
    projects,
    version: 1,
  };
};

export const getProjectContentBySlug = (content, slug) =>
  (content?.projects || []).find((project) => project.slug === slug) || null;

