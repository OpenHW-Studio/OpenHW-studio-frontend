import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getResolvedClassAdventure } from "../../services/classAdventureService";
import { updateClassAdventureConfig } from "../../services/classAdventureService";
import { getProjectFlashcards } from "../../services/gamification/ProjectData";
import { PROJECTS } from "../../services/gamification/ProjectsConfig";
import { COMPONENTS } from "../../services/gamification/ComponentsConfig";

export default function TeacherProjectContentEditor() {
  const { classId, projectSlug } = useParams();
  const navigate = useNavigate();

  const [theoryCards, setTheoryCards] = useState([]);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [rewardComponents, setRewardComponents] = useState([]);
  const [activeTab, setActiveTab] = useState("theory");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await getResolvedClassAdventure(classId);
        if (cancelled) return;
        const project = response?.resolved?.projects?.find(
          (p) => p.slug === projectSlug
        );
        if (!project) {
          // Create new project from template
          const template = getProjectFlashcards(projectSlug);
          const newCards = template.map((card, idx) => ({
            id: `card-${Date.now()}-${idx}`,
            emoji: card.emoji || "📚",
            front: card.front || "",
            simple: card.simple || "",
            detail: card.detail || "",
            funFact: card.funFact || "",
          }));
          setTheoryCards(newCards);
          setQuizQuestions(
            template.map((card, i) => ({
              id: `quiz-${Date.now()}-${i}`,
              question: card.quiz?.question || card.front || "",
              options: card.quiz?.options?.slice(0, 4) || ["", "", "", ""],
              correctAnswer: Number.isFinite(card.quiz?.correctAnswer)
                ? card.quiz.correctAnswer
                : 0,
            }))
          );
          // New projects start with no reward components selected
          setRewardComponents([]);
        } else {
          setTheoryCards(project.theory || []);
          setQuizQuestions(project.quizQuestions || []);
          // Extract component IDs from rewardComponents array
          const rewardIds = (project.rewardComponents || []).map(c => c.id).filter(Boolean);
          setRewardComponents(rewardIds);
        }
      } catch (err) {
        setError(err?.message || "Failed to load project content");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [classId, projectSlug]);

  const projectMeta = PROJECTS.find((p) => p.slug === projectSlug);
  const color = projectMeta?.color || "#3b82f6";

  // Theory card handlers
  const updateCard = (index, field, value) => {
    setTheoryCards((prev) =>
      prev.map((card, i) => (i === index ? { ...card, [field]: value } : card))
    );
  };

  const addCard = () => {
    setTheoryCards((prev) => [
      ...prev,
      {
        id: `card-${Date.now()}`,
        emoji: "📚",
        front: "",
        simple: "",
        detail: "",
        funFact: "",
      },
    ]);
  };

  const removeCard = (index) => {
    setTheoryCards((prev) => prev.filter((_, i) => i !== index));
  };

  // Quiz handlers
  const updateQuizQuestion = (index, field, value) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const updateQuizOption = (index, optIdx, value) => {
    setQuizQuestions((prev) =>
      prev.map((q, i) =>
        i === index
          ? {
              ...q,
              options: (q.options || ["", "", "", ""]).map((opt, j) =>
                j === optIdx ? value : opt
              ),
            }
          : q
      )
    );
  };

  const addQuizQuestion = () => {
    setQuizQuestions((prev) => [
      ...prev,
      {
        id: `quiz-${Date.now()}`,
        question: "",
        options: ["", "", "", ""],
        correctAnswer: 0,
        explanation: "",
      },
    ]);
  };

  const removeQuizQuestion = (index) => {
    setQuizQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Rewards/Components handlers
  const toggleComponent = (compId) => {
    setRewardComponents((prev) =>
      prev.includes(compId)
        ? prev.filter((id) => id !== compId)
        : [...prev, compId]
    );
  };

  const handleSave = async () => {
    // Validation - Theory
    for (let i = 0; i < theoryCards.length; i++) {
      const card = theoryCards[i];
      if (!card.front?.trim()) {
        setError(`Theory Card ${i + 1}: Front (question) is required.`);
        setActiveTab("theory");
        return;
      }
      if (!card.simple?.trim()) {
        setError(`Theory Card ${i + 1}: Simple summary is required.`);
        setActiveTab("theory");
        return;
      }
      if (!card.detail?.trim()) {
        setError(`Theory Card ${i + 1}: Detail explanation is required.`);
        setActiveTab("theory");
        return;
      }
    }

    // Validation - Quiz
    for (let i = 0; i < quizQuestions.length; i++) {
      const q = quizQuestions[i];
      if (!q.question?.trim()) {
        setError(`Quiz Question ${i + 1}: Question text is required.`);
        setActiveTab("quiz");
        return;
      }
      const nonEmptyOptions = (q.options || []).filter((opt) => opt?.trim());
      if (nonEmptyOptions.length < 2) {
        setError(`Quiz Question ${i + 1}: At least 2 options are required.`);
        setActiveTab("quiz");
        return;
      }
      if (q.correctAnswer < 0 || q.correctAnswer > 3) {
        setError(`Quiz Question ${i + 1}: Correct answer must be A, B, C, or D.`);
        setActiveTab("quiz");
        return;
      }
    }

    setSaving(true);
    setError("");
    setSuccessMsg("");
    try {
      const response = await getResolvedClassAdventure(classId);
      const currentConfig = response?.resolved || { worlds: [], projects: [] };

      const existingIndex = currentConfig.projects.findIndex(
        (p) => p.slug === projectSlug
      );

       // Build rewardComponents array with full component data
       const selectedRewardComponents = COMPONENTS.filter((c) =>
         rewardComponents.includes(c.id)
       ).map(({ id, name, icon, color, description }) => ({
         id,
         name,
         icon,
         color,
         desc: description || "",
       }));

      let updatedProject;
      if (existingIndex >= 0) {
        const existing = currentConfig.projects[existingIndex];
        updatedProject = {
          ...existing,
          theory: theoryCards,
          quizQuestions: quizQuestions,
          rewardComponents: selectedRewardComponents,
        };
       } else {
         updatedProject = {
           id: `custom-${projectSlug}-${Date.now()}`,
           slug: projectSlug,
           worldId: `world-1`,
           order: (currentConfig.projects?.length || 0) + 1,
           enabled: true,
           title: projectMeta?.title || projectSlug,
           prerequisite: null,
           xpReward: 100,
           rewardComponents: selectedRewardComponents,
           theory: theoryCards,
           quizQuestions: quizQuestions,
           nodes: [
             { id: "read", type: "theory", title: "Reading", order: 1, content: {} },
             { id: "quiz", type: "quiz", title: "Quiz", order: 2, content: {} },
             { id: "unlock", type: "reward", title: "Component Unlock", order: 3, content: {} },
             { id: "sim", type: "assessment", title: "Project Assessment", order: 4, content: {} },
           ],
         };
       }

      const mergedProjects = existingIndex >= 0
        ? currentConfig.projects.map((p, i) => (i === existingIndex ? updatedProject : p))
        : [...(currentConfig.projects || []), updatedProject];

      const newConfig = {
        ...currentConfig,
        projects: mergedProjects,
      };

      await updateClassAdventureConfig(classId, newConfig);
      setSuccessMsg("Project content saved successfully!");
      setTimeout(() => {
        navigate(`/teacher/classes/${classId}`);
      }, 1200);
    } catch (err) {
      setError(err?.message || "Failed to save project content");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p>Loading project content...</p>
      </div>
    );
  }

  return (
    <div className="teacher-editor-page">
      <div className="teacher-editor-topbar">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate(`/teacher/classes/${classId}`)}
          style={{
            background: "rgba(255,255,255,.06)",
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            cursor: "pointer",
            color: "#94a3b8",
          }}
        >
          ← Back to Class
        </button>
        <div style={{ flex: 1, marginLeft: 16 }}>
          <div style={{ fontSize: 12, color, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
            📖 {projectMeta?.title || projectSlug}
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#f0f4ff" }}>Content Editor</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => navigate(`/teacher/classes/${classId}`)}
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              border: "none",
              background: "rgba(255,255,255,.08)",
              color: "#cbd5e1",
              fontWeight: 700,
              cursor: "pointer",
            }}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "none",
              background: color,
              color: "#fff",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ color: "#f87171", padding: "12px 24px", background: "rgba(239,68,68,.12)" }}>
          {error}
        </div>
      )}
      {successMsg && (
        <div style={{ color: "#34d399", padding: "12px 24px", background: "rgba(52,211,153,.12)" }}>
          {successMsg}
        </div>
      )}

      <div className="teacher-editor-tabs" style={{ display: "flex", gap: 6, padding: "12px 24px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <button
          type="button"
          onClick={() => setActiveTab("theory")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "theory" ? color : "rgba(255,255,255,.06)",
            color: activeTab === "theory" ? "#fff" : "#94a3b8",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Theory ({theoryCards.length} cards)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("quiz")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "quiz" ? color : "rgba(255,255,255,.06)",
            color: activeTab === "quiz" ? "#fff" : "#94a3b8",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Quiz ({quizQuestions.length} questions)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("rewards")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: "none",
            background: activeTab === "rewards" ? color : "rgba(255,255,255,.06)",
            color: activeTab === "rewards" ? "#fff" : "#94a3b8",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Rewards ({rewardComponents.length} components)
        </button>
      </div>

      <div className="teacher-editor-content" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 24 }}>
        {/* Left: Editor */}
        <div className="editor-pane">
          {activeTab === "theory" && (
            <div style={{ display: "grid", gap: 16 }}>
              {theoryCards.map((card, idx) => (
                <div
                  key={card.id}
                  className="editor-card"
                  style={{
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 14,
                    padding: 20,
                    background: "rgba(255,255,255,.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <strong style={{ fontSize: 16, color: "#f0f4ff" }}>
                      Card {idx + 1}
                    </strong>
                    <button
                      type="button"
                      onClick={() => removeCard(idx)}
                      style={{
                        background: "rgba(239,68,68,.14)",
                        border: "none",
                        borderRadius: 6,
                        color: "#f87171",
                        cursor: "pointer",
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      title="Remove card"
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "auto 1fr" }}>
                    <label style={{ color: "#94a3b8" }}>Emoji</label>
                    <input
                      type="text"
                      value={card.emoji || ""}
                      onChange={(e) => updateCard(idx, "emoji", e.target.value)}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                      }}
                    />

                    <label style={{ color: "#94a3b8" }}>Front</label>
                    <input
                      type="text"
                      value={card.front || ""}
                      onChange={(e) => updateCard(idx, "front", e.target.value)}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                      }}
                      placeholder="Question/title"
                    />

                    <label style={{ color: "#94a3b8" }}>Simple</label>
                    <textarea
                      value={card.simple || ""}
                      onChange={(e) => updateCard(idx, "simple", e.target.value)}
                      rows={2}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                        resize: "vertical",
                      }}
                      placeholder="Short summary (back face)"
                    />

                    <label style={{ color: "#94a3b8" }}>Detail</label>
                    <textarea
                      value={card.detail || ""}
                      onChange={(e) => updateCard(idx, "detail", e.target.value)}
                      rows={4}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                        resize: "vertical",
                      }}
                      placeholder="Full explanation (back face)"
                    />

                    <label style={{ color: "#94a3b8" }}>Fun Fact</label>
                    <textarea
                      value={card.funFact || ""}
                      onChange={(e) => updateCard(idx, "funFact", e.target.value)}
                      rows={2}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                        resize: "vertical",
                      }}
                      placeholder="Optional fun fact"
                    />
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addCard}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "2px dashed rgba(255,255,255,.12)",
                  background: "transparent",
                  color: "#60a5fa",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                + Add Card
              </button>
            </div>
          )}

          {activeTab === "quiz" && (
            <div style={{ display: "grid", gap: 16 }}>
              {quizQuestions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  className="editor-card"
                  style={{
                    border: "1px solid rgba(255,255,255,.08)",
                    borderRadius: 14,
                    padding: 20,
                    background: "rgba(255,255,255,.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <strong style={{ fontSize: 16, color: "#f0f4ff" }}>
                      Question {idx + 1}
                    </strong>
                    <button
                      type="button"
                      onClick={() => removeQuizQuestion(idx)}
                      style={{
                        background: "rgba(239,68,68,.14)",
                        border: "none",
                        borderRadius: 6,
                        color: "#f87171",
                        cursor: "pointer",
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                      title="Remove question"
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: "grid", gap: 10, gridTemplateColumns: "auto 1fr" }}>
                    <label style={{ color: "#94a3b8" }}>Question</label>
                    <input
                      type="text"
                      value={q.question || ""}
                      onChange={(e) => updateQuizQuestion(idx, "question", e.target.value)}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                      }}
                      placeholder="Quiz question"
                    />

                    {[0, 1, 2, 3].map((optIdx) => (
                      <div key={optIdx} style={{ display: "contents" }}>
                        <label style={{ color: "#94a3b8" }}>Option {["A","B","C","D"][optIdx]}</label>
                        <input
                          type="text"
                          value={q.options?.[optIdx] || ""}
                          onChange={(e) => updateQuizOption(idx, optIdx, e.target.value)}
                          style={{
                            background: "rgba(255,255,255,.05)",
                            border: "1px solid rgba(255,255,255,.1)",
                            borderRadius: 6,
                            padding: "8px 10px",
                            color: "#e2e8f0",
                          }}
                          placeholder={`Option ${["A","B","C","D"][optIdx]}`}
                        />
                      </div>
                    ))}

                    <label style={{ color: "#94a3b8" }}>Correct Answer</label>
                    <select
                      value={q.correctAnswer || 0}
                      onChange={(e) => updateQuizQuestion(idx, "correctAnswer", Number(e.target.value))}
                      style={{
                        background: "rgba(255,255,255,.05)",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        color: "#e2e8f0",
                        cursor: "pointer",
                      }}
                    >
                      <option value={0} style={{background: "#1e1e1e"}}>A</option>
                      <option value={1} style={{background: "#1e1e1e"}}>B</option>
                      <option value={2} style={{background: "#1e1e1e"}}>C</option>
                      <option value={3} style={{background: "#1e1e1e"}}>D</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={addQuizQuestion}
                style={{
                  padding: "12px 20px",
                  borderRadius: 10,
                  border: "2px dashed rgba(255,255,255,.12)",
                  background: "transparent",
                  color: "#60a5fa",
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 8,
                }}
              >
                + Add Question
              </button>
            </div>
          )}

          {activeTab === "rewards" && (
            <div style={{ display: "grid", gap: 12 }}>
              <p style={{ color: "#94a3b8", fontSize: 14 }}>
                Select components students will unlock after completing this project:
              </p>
              {COMPONENTS.map((comp) => {
                const isSelected = rewardComponents.includes(comp.id);
                return (
                  <div
                    key={comp.id}
                    onClick={() => toggleComponent(comp.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 16px",
                      borderRadius: 10,
                      border: `1px solid ${isSelected ? comp.color + "60" : "rgba(255,255,255,.08)"}`,
                      background: isSelected ? comp.color + "12" : "rgba(255,255,255,.03)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: `2px solid ${isSelected ? comp.color : "rgba(255,255,255,.2)"}`,
                        background: isSelected ? comp.color : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isSelected ? "#fff" : "transparent",
                        fontSize: 12,
                      }}
                    >
                      {isSelected ? "✓" : ""}
                    </div>
                    <span style={{ fontSize: 24 }}>{comp.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: "#f0f4ff" }}>{comp.name}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{comp.category} • {comp.description?.slice(0, 60)}...</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="preview-pane" style={{ display: "flex", "flexDirection": "column", gap: 24 }}>
          <div style={{
            border: "1px solid rgba(255,255,255,.08)",
            borderRadius: 14,
            padding: 20,
            background: "rgba(255,255,255,.02)",
          }}>
            <h4 style={{ margin: "0 0 12px", color: "#f0f4ff", fontSize: 16 }}>
              Student Preview
            </h4>

            {activeTab === "theory" && theoryCards.length > 0 && (
              <div
                className="preview-flipcard"
                style={{
                  perspective: "1000px",
                  minHeight: 320,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    minHeight: 280,
                    position: "relative",
                    transformStyle: "preserve-3d",
                    borderRadius: 20,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    background: `linear-gradient(145deg,${color}18,${color}07)`,
                    border: `2px solid ${color}45`,
                  }}
                >
                  <div style={{ fontSize: 64, marginBottom: 14 }}>
                    {theoryCards[0].emoji}
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 900, color: "#f0f4ff", marginBottom: 10 }}>
                    {theoryCards[0].front || "(Card front)"}
                  </div>
                  <div style={{ fontSize: 15, color: "#94a3b8", lineHeight: 1.65 }}>
                    {theoryCards[0].simple || "(short summary)"}
                  </div>
                  <div style={{ marginTop: 20, fontSize: 11, fontWeight: 800, color, letterSpacing: ".08em", background: color + "18", padding: "5px 14px", borderRadius: 20, border: `1px solid ${color}33` }}>
                    TAP TO FLIP ▶
                  </div>
                </div>
              </div>
            )}

            {activeTab === "theory" && theoryCards.length > 1 && (
              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap", justifyContent: "center" }}>
                {theoryCards.slice(0, 5).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: i === 0 ? color : "rgba(255,255,255,.1)",
                    }}
                  />
                ))}
              </div>
            )}

            {activeTab === "quiz" && quizQuestions.length > 0 && (
              <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 16, background: "rgba(255,255,255,.02)" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                  {quizQuestions[0].question || "(Quiz question)"}
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(quizQuestions[0].options || ["", "", "", ""]).map((opt, i) => (
                    <div key={i} style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,.1)",
                      background: i === (quizQuestions[0].correctAnswer || 0) ? "rgba(34,197,94,.14)" : "rgba(255,255,255,.04)",
                      color: i === (quizQuestions[0].correctAnswer || 0) ? "#34d399" : "#94a3b8",
                      fontSize: 13,
                      fontWeight: 700,
                    }}>
                      {["A","B","C","D"][i]}. {opt}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "rewards" && rewardComponents.length > 0 && (
              <div style={{ display: "grid", gap: 10 }}>
                <p style={{ fontSize: 12, color: "#94a3b8" }}>
                  Students unlock these components upon completing the project:
                </p>
                {rewardComponents.map((compId) => {
                  const comp = COMPONENTS.find(c => c.id === compId);
                  if (!comp) return null;
                  return (
                    <div
                      key={compId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid rgba(255,255,255,.08)",
                        background: comp.color + "12",
                      }}
                    >
                      <span style={{ fontSize: 20 }}>{comp.icon}</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#f0f4ff", fontSize: 13 }}>{comp.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{comp.category}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {((activeTab === "theory" && theoryCards.length === 0) ||
              (activeTab === "quiz" && quizQuestions.length === 0) ||
              (activeTab === "rewards" && rewardComponents.length === 0)) && (
              <p style={{ color: "#64748b", textAlign: "center" }}>
                Add content on the left to see preview
              </p>
            )}
          </div>

          <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
            {activeTab === "rewards" ? (
              <><strong>Note:</strong> Selected components will be unlocked in students' toolboxes after project completion.</>
            ) : (
              <><strong>Note:</strong> This preview shows how students will see your content. Quiz option highlighted is marked as correct.</>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}