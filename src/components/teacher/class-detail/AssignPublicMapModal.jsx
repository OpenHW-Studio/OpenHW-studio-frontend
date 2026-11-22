import { useState, useEffect, useMemo } from "react";
import {
  Search,
  X,
  Compass,
  Check,
  Plus,
  Loader2,
  Cpu,
  Award,
  Sparkles,
  Layers,
  Globe,
  FolderHeart,
  BookOpen
} from "lucide-react";
import {
  fetchAdventureMaps,
  assignAdventureMapToClassroom,
  unassignAdventureMapFromClassroom
} from "../../../services/adventureMapService.js";

const BOARDS = [
  { id: "all", label: "All Boards" },
  { id: "arduino-uno", label: "Arduino Uno" },
  { id: "esp32", label: "ESP32" },
  { id: "raspberry-pi-pico", label: "Raspberry Pi Pico" }
];

export default function AssignPublicMapModal({
  isOpen,
  initialTab = "public",
  onClose,
  classId,
  classroomName,
  assignedMapIds = [],
  onMapAssigned,
  onCreateNewMap
}) {
  const [activeTab, setActiveTab] = useState(initialTab || "public");
  const [maps, setMaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("all");
  const [actionMapId, setActionMapId] = useState(null);
  const [localAssignedMapIds, setLocalAssignedMapIds] = useState(assignedMapIds || []);
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    setLocalAssignedMapIds(assignedMapIds || []);
  }, [assignedMapIds]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || "public");
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const loadMaps = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeTab === "my-maps") {
          const res = await fetchAdventureMaps({ tab: "my-maps", limit: 100 });
          if (!cancelled) {
            setMaps(res?.maps || []);
          }
        } else {
          const res = await fetchAdventureMaps({ limit: 100 });
          if (!cancelled) {
            // Filter to public maps (those without a classroomId)
            const publicMaps = (res?.maps || []).filter((m) => !m.classroomId);
            setMaps(publicMaps);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load available adventure maps.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMaps();
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeTab]);

  const filteredMaps = useMemo(() => {
    return maps.filter((m) => {
      const matchBoard =
        selectedBoard === "all" ||
        (m.boardArchitecture?.board || "").toLowerCase().includes(selectedBoard.toLowerCase()) ||
        (m.title || "").toLowerCase().includes(selectedBoard.toLowerCase());

      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        (m.title || "").toLowerCase().includes(query) ||
        (m.description || "").toLowerCase().includes(query) ||
        (m.tagline || "").toLowerCase().includes(query) ||
        (m.tags || []).some((t) => t.toLowerCase().includes(query));

      return matchBoard && matchQuery;
    });
  }, [maps, selectedBoard, searchQuery]);

  const handleToggleAssign = async (map) => {
    const isAssigned = (localAssignedMapIds || []).includes(map._id);
    setActionMapId(map._id);
    try {
      if (isAssigned) {
        await unassignAdventureMapFromClassroom(classId, map._id);
        setLocalAssignedMapIds((prev) => prev.filter((id) => id !== map._id));
        setToastMessage({ type: "info", text: `Unassigned "${map.title}" from this classroom.` });
      } else {
        await assignAdventureMapToClassroom(classId, map._id);
        setLocalAssignedMapIds((prev) => [...prev, map._id]);
        setToastMessage({ type: "success", text: `Assigned "${map.title}" to this classroom!` });
      }
      if (onMapAssigned) {
        await onMapAssigned();
      }
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      setToastMessage({ type: "error", text: err.message || "Failed to update assignment." });
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setActionMapId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "880px",
          maxHeight: "90vh",
          backgroundColor: "var(--card, #ffffff)",
          borderRadius: "18px",
          border: "1px solid var(--border, #e2e8f0)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background:
              activeTab === "my-maps"
                ? "linear-gradient(to right, rgba(16, 185, 129, 0.06), transparent)"
                : "linear-gradient(to right, rgba(99, 102, 241, 0.05), transparent)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                backgroundColor:
                  activeTab === "my-maps"
                    ? "rgba(16, 185, 129, 0.12)"
                    : "rgba(99, 102, 241, 0.12)",
                color: activeTab === "my-maps" ? "#10b981" : "#6366f1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {activeTab === "my-maps" ? <FolderHeart size={22} /> : <Globe size={22} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--text, #0f172a)" }}>
                {activeTab === "my-maps" ? "Select Your Adventure Maps" : "Assign Public Adventure Map"}
              </h2>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "var(--text2, #64748b)" }}>
                {activeTab === "my-maps"
                  ? `Choose from maps you created to assign to ${classroomName || "this class"}`
                  : `Select an existing community or official journey to assign to ${classroomName || "this class"}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--text3, #94a3b8)",
              padding: "6px",
              borderRadius: "8px",
              display: "flex"
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            padding: "0 24px",
            gap: "8px",
            backgroundColor: "var(--bg, #f8fafc)"
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("public")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              fontSize: "13px",
              fontWeight: activeTab === "public" ? 700 : 500,
              color: activeTab === "public" ? "#4f46e5" : "var(--text2, #64748b)",
              borderBottom: activeTab === "public" ? "2.5px solid #4f46e5" : "2.5px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <Globe size={15} />
            Assign Public Map
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("my-maps")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 18px",
              border: "none",
              background: "transparent",
              fontSize: "13px",
              fontWeight: activeTab === "my-maps" ? 700 : 500,
              color: activeTab === "my-maps" ? "#10b981" : "var(--text2, #64748b)",
              borderBottom: activeTab === "my-maps" ? "2.5px solid #10b981" : "2.5px solid transparent",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <FolderHeart size={15} />
            Select Your Maps
          </button>
        </div>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div
            style={{
              padding: "10px 24px",
              backgroundColor:
                toastMessage.type === "success"
                  ? "rgba(16, 185, 129, 0.12)"
                  : toastMessage.type === "error"
                  ? "rgba(239, 68, 68, 0.12)"
                  : "rgba(99, 102, 241, 0.12)",
              color:
                toastMessage.type === "success"
                  ? "#059669"
                  : toastMessage.type === "error"
                  ? "#ef4444"
                  : "#6366f1",
              fontSize: "13px",
              fontWeight: "600",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderBottom: "1px solid var(--border, #e2e8f0)",
              animation: "fadeIn 0.2s ease"
            }}
          >
            {toastMessage.type === "success" ? <Check size={16} /> : null}
            <span>{toastMessage.text}</span>
          </div>
        )}

        {/* Filters */}
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          {/* Search Input */}
          <div
            style={{
              position: "relative",
              flex: "1 1 280px",
              maxWidth: "400px"
            }}
          >
            <Search
              size={16}
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text3, #94a3b8)"
              }}
            />
            <input
              type="text"
              placeholder="Search by title, board, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "10px",
                border: "1px solid var(--border, #cbd5e1)",
                backgroundColor: "var(--bg, #f8fafc)",
                fontSize: "13px",
                color: "var(--text, #0f172a)",
                outline: "none"
              }}
            />
          </div>

          {/* Board Badges */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {BOARDS.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBoard(b.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: "600",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    selectedBoard === b.id
                      ? "var(--primary, #4f46e5)"
                      : "var(--bg2, #f1f5f9)",
                  color: selectedBoard === b.id ? "#ffffff" : "var(--text2, #475569)",
                  transition: "all 0.15s ease"
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body / Map Cards */}
        <div
          style={{
            padding: "20px 24px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }}
        >
          {loading ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px",
                gap: "12px",
                color: "var(--text2, #64748b)"
              }}
            >
              <Loader2 size={32} className="teacher-spinner" style={{ animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "14px" }}>
                {activeTab === "my-maps"
                  ? "Loading your created adventure maps..."
                  : "Loading adventure journeys..."}
              </span>
            </div>
          ) : error ? (
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#ef4444",
                fontSize: "13px",
                textAlign: "center"
              }}
            >
              {error}
            </div>
          ) : filteredMaps.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 24px",
                textAlign: "center",
                gap: "10px"
              }}
            >
              {activeTab === "my-maps" ? (
                <>
                  <Sparkles size={40} style={{ color: "#10b981" }} />
                  <strong style={{ fontSize: "16px", color: "var(--text, #0f172a)" }}>
                    No created maps found
                  </strong>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text2, #64748b)", maxWidth: "380px", lineHeight: 1.5 }}>
                    {searchQuery
                      ? "No maps matched your search filter."
                      : "You haven't created any custom maps yet. You can design one in the Adventure Creator Studio!"}
                  </p>
                  {onCreateNewMap && (
                    <button
                      type="button"
                      onClick={onCreateNewMap}
                      className="btn btn-primary"
                      style={{
                        marginTop: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "9px 18px",
                        borderRadius: 10,
                        border: "none",
                        background: "linear-gradient(135deg, #4f46e5, #6366f1)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer"
                      }}
                    >
                      <Plus size={16} /> Create Map Now
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Compass size={40} style={{ color: "var(--text3, #94a3b8)" }} />
                  <strong style={{ fontSize: "15px", color: "var(--text, #0f172a)" }}>
                    No maps found
                  </strong>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text2, #64748b)", maxWidth: "340px" }}>
                    {searchQuery
                      ? "Try refining your search terms or selecting another board category."
                      : "No public adventure maps are currently available."}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
                gap: "14px"
              }}
            >
              {filteredMaps.map((map) => {
                const isNativeClassMap =
                  map.classroomId &&
                  (map.classroomId === classId ||
                    map.classroomId?._id === classId ||
                    map.classroomId?.toString() === classId?.toString());
                const isAssigned = (localAssignedMapIds || []).includes(map._id) || isNativeClassMap;
                const isProcessing = actionMapId === map._id;
                const totalXP =
                  map.worlds?.reduce(
                    (acc, w) =>
                      acc +
                      (w.islands?.reduce((iAcc, isl) => iAcc + (isl.xpReward || 0), 0) || 0),
                    0
                  ) || 0;

                return (
                  <div
                    key={map._id}
                    style={{
                      border: isAssigned
                        ? "1.5px solid #6366f1"
                        : "1px solid var(--border, #e2e8f0)",
                      borderRadius: "14px",
                      padding: "16px",
                      backgroundColor: isAssigned
                        ? "rgba(99, 102, 241, 0.03)"
                        : "var(--card, #ffffff)",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease"
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "10px",
                          gap: "8px",
                          flexWrap: "wrap"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              textTransform: "uppercase",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              backgroundColor:
                                map.boardArchitecture?.badgeColor || "#10b981",
                              color: "#ffffff",
                              letterSpacing: "0.5px"
                            }}
                          >
                            {map.boardArchitecture?.board || "Hardware"}
                          </span>

                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: "var(--bg2, #f1f5f9)",
                              color: "var(--text2, #475569)"
                            }}
                          >
                            {map.difficulty || "Beginner"}
                          </span>
                        </div>

                        {isNativeClassMap ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "700",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(16, 185, 129, 0.12)",
                              color: "#059669"
                            }}
                          >
                            ✓ Native Class Map
                          </span>
                        ) : activeTab === "my-maps" ? (
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: "600",
                              padding: "2px 8px",
                              borderRadius: "6px",
                              backgroundColor: "rgba(99, 102, 241, 0.08)",
                              color: "#4f46e5"
                            }}
                          >
                            Created by You
                          </span>
                        ) : null}
                      </div>

                      {/* Title & Tagline */}
                      <h4
                        style={{
                          margin: "0 0 4px 0",
                          fontSize: "15px",
                          fontWeight: "700",
                          color: "var(--text, #0f172a)"
                        }}
                      >
                        {map.title}
                      </h4>
                      <p
                        style={{
                          margin: 0,
                          fontSize: "12px",
                          color: "var(--text2, #64748b)",
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {map.tagline || map.description || "An interactive learning journey."}
                      </p>
                    </div>

                    {/* Stats & Actions */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingTop: "10px",
                        borderTop: "1px solid var(--border, #f1f5f9)"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: "12px",
                          fontSize: "11px",
                          color: "var(--text2, #64748b)",
                          fontWeight: "600"
                        }}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Layers size={13} style={{ color: "#6366f1" }} />
                          {map.worlds?.length || 0} Worlds
                        </span>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Sparkles size={13} style={{ color: "#eab308" }} />
                          {totalXP} XP
                        </span>
                      </div>

                      {isNativeClassMap ? (
                        <span
                          style={{
                            fontSize: "12px",
                            fontWeight: "600",
                            color: "#059669"
                          }}
                        >
                          Always Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleAssign(map)}
                          disabled={isProcessing}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            padding: "6px 14px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: isAssigned ? "1px solid #6366f1" : "none",
                            backgroundColor: isAssigned
                              ? "transparent"
                              : "var(--primary, #4f46e5)",
                            color: isAssigned ? "#6366f1" : "#ffffff",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {isProcessing ? (
                            <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                          ) : isAssigned ? (
                            <>
                              <Check size={13} /> Assigned
                            </>
                          ) : (
                            <>
                              <Plus size={13} /> Assign
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border, #e2e8f0)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--bg, #f8fafc)"
          }}
        >
          <span style={{ fontSize: "12px", color: "var(--text2, #64748b)" }}>
            Assigned maps immediately become playable by all students enrolled in this classroom.
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "8px",
              border: "1px solid var(--border, #cbd5e1)",
              backgroundColor: "var(--card, #ffffff)",
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--text, #0f172a)",
              cursor: "pointer"
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
