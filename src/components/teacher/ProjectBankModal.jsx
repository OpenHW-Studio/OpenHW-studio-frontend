import { useState, useEffect, useMemo } from "react";
import { getSharedProjectBank } from "../../services/projectBankService";

function getProjectBoardType(project) {
  const components = project.components || [];
  const boardTypes = ["arduino-uno", "arduino-nano", "arduino-mega", "pico", "pico-w"];
  for (const comp of components) {
    const t = String(comp.type || comp.id || "").replace(/^openhw-/, "").replace(/^wokwi-/, "");
    for (const bt of boardTypes) {
      if (t.includes(bt)) return bt;
    }
  }
  return "unknown";
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
      const b = getProjectBoardType(p);
      if (b && b !== "unknown") set.add(b);
    });
    return Array.from(set).sort();
  }, [projects]);

  const filtered = useMemo(() => {
    let list = projects;
    if (boardFilter !== "all") {
      list = list.filter((p) => getProjectBoardType(p) === boardFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
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
                const board = getProjectBoardType(project);
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
                      <span
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
