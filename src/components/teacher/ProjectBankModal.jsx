import { useState, useEffect, useMemo } from "react";
import { getSharedProjectBank } from "../../services/projectBankService";
import { getDifficultyDisplay } from "../../services/gamification/ProjectsConfig.js";

const BOARD_HINTS = ["arduino", "arduino-uno", "arduino-nano", "arduino-mega", "pico-w", "pico", "raspberry-pi-pico-w", "raspberry-pi-pico", "esp32-s3", "esp32-c3", "esp32", "stm32"];

const normalizeBoardValue = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^openhw-/, "")
    .replace(/^wokwi-/, "")
    .replace(/^board-/, "")
    .replace(/[_\s]+/g, "-");

const isBoardLike = (value) => {
  const normalized = normalizeBoardValue(value);
  return Boolean(normalized) && BOARD_HINTS.some((hint) => normalized.includes(hint) || hint.includes(normalized));
};

function getProjectBoards(project) {
  const storedBoards = Array.isArray(project?.boards) ? project.boards : [];
  const fromField = project?.board ? [project.board] : [];
  const fromRewards = Array.isArray(project?.rewardComponents)
    ? project.rewardComponents.flatMap((item) => [item?.board, item?.type, item?.id, item?.name])
    : [];
  const fromComponents = Array.isArray(project?.components)
    ? project.components.flatMap((item) => [item?.board, item?.type, item?.id, item?.name, item?.label])
    : [];

  const boards = [...storedBoards, ...fromField, ...fromRewards, ...fromComponents]
    .map(normalizeBoardValue)
    .filter(isBoardLike);

  return [...new Set(boards)];
}

function getProjectSearchBlob(project) {
  const rewards = Array.isArray(project?.rewardComponents)
    ? project.rewardComponents.flatMap((item) => [item?.id, item?.type, item?.name, item?.description])
    : [];
  const components = Array.isArray(project?.components)
    ? project.components.flatMap((item) => [item?.id, item?.type, item?.label])
    : [];

  return [
    project?.title,
    project?.slug,
    project?.description,
    project?.difficulty,
    project?.estimatedTime,
    project?.board,
    ...(project?.boards || []),
    ...(project?.tags || []),
    ...rewards,
    ...components,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function ProjectBankModal({ isOpen, onClose, onAddProject, selectedWorldId }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [boardFilter, setBoardFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoading(true);
    getSharedProjectBank()
      .then((data) => {
        if (!cancelled) {
          setProjects(data?.projects || data || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const boards = useMemo(() => {
    const set = new Set();
    projects.forEach((p) => {
      getProjectBoards(p).forEach((b) => set.add(b));
    });
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (boardFilter !== "all") {
      const boardQuery = normalizeBoardValue(boardFilter);
      list = list.filter((p) => getProjectBoards(p).some((board) => normalizeBoardValue(board) === boardQuery));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => getProjectSearchBlob(p).includes(q));
    }
    return list;
  }, [projects, boardFilter, searchQuery]);

  const handleAdd = (project) => {
    onAddProject({
      ...project,
      _newId: `project-${Date.now()}`,
      worldId: selectedWorldId || project.worldId,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "grid",
        placeItems: "center",
        zIndex: 900,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "min(720px, 94vw)",
          maxHeight: "85vh",
          background: "var(--bg, #0b1220)",
          borderRadius: 16,
          border: "1px solid var(--border, rgba(255,255,255,0.08))",
          display: "grid",
          gridTemplateRows: "auto 1fr",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "var(--text, #e2e8f0)" }}>
              Add from Project Bank
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text2, #94a3b8)" }}>
              Shared projects filtered by board
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "1px solid var(--border, rgba(255,255,255,0.08))",
              background: "var(--card, #111827)",
              color: "var(--text, #e2e8f0)",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ padding: 14, display: "grid", gap: 12, overflow: "auto" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              value={boardFilter}
              onChange={(e) => setBoardFilter(e.target.value)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                background: "var(--bg2, #0f172a)",
                color: "var(--text, #e2e8f0)",
                fontSize: 13,
              }}
            >
              <option value="all">All Boards</option>
              {boards.map((b) => (
                <option key={b} value={b}>
                  {b.toUpperCase()}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: 140,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--border, rgba(255,255,255,0.08))",
                background: "var(--bg2, #0f172a)",
                color: "var(--text, #e2e8f0)",
                fontSize: 13,
              }}
            />
          </div>

          {loading ? (
            <p style={{ color: "var(--text2, #94a3b8)", textAlign: "center" }}>Loading shared projects...</p>
          ) : filtered.length === 0 ? (
            <p style={{ color: "var(--text2, #94a3b8)", textAlign: "center" }}>No projects match your filters.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filtered.map((project) => {
                const projectBoards = getProjectBoards(project);
                return (
                  <div
                    key={project._id || project.slug}
                    draggable="true"
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(project));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => handleAdd(project)}
                    style={{
                      border: "1px solid var(--border, rgba(255,255,255,0.08))",
                      borderRadius: 12,
                      padding: 14,
                      background: "var(--card, #111827)",
                      cursor: "pointer",
                      display: "grid",
                      gap: 6,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent, #38bdf8)";
                      e.currentTarget.style.background = "var(--card2, #0b1220)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border, rgba(255,255,255,0.08))";
                      e.currentTarget.style.background = "var(--card, #111827)";
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <strong style={{ fontSize: 14, fontWeight: 700, color: "var(--text, #e2e8f0)" }}>
                        {project.title || project.slug}
                      </strong>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {projectBoards.length > 0 ? projectBoards.map((board) => (
                          <span
                            key={board}
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "3px 7px",
                              borderRadius: 5,
                              background: "rgba(56,189,248,0.15)",
                              color: "var(--accent, #38bdf8)",
                            }}
                          >
                            {board}
                          </span>
                        )) : (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              textTransform: "uppercase",
                              padding: "3px 7px",
                              borderRadius: 5,
                              background: "rgba(148,163,184,0.15)",
                              color: "var(--text2, #94a3b8)",
                            }}
                          >
                            unknown
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            textTransform: "capitalize",
                            padding: "3px 7px",
                            borderRadius: 5,
                            background: getDifficultyDisplay(project.difficulty).bg,
                            color: getDifficultyDisplay(project.difficulty).color,
                            border: `1px solid ${getDifficultyDisplay(project.difficulty).color}40`,
                          }}
                        >
                          {getDifficultyDisplay(project.difficulty).label}
                        </span>
                      </div>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text2, #94a3b8)",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {project.description || "No description"}
                    </p>
                    <div style={{ fontSize: 11, color: "var(--text3, #64748b)" }}>Click to add</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
