import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bug,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ThumbsUp,
  ThumbsDown,
  Search,
  Plus,
  X,
  ExternalLink,
  ShieldCheck,
  Eye,
  Cpu,
  Layers,
  Server,
  Trash2,
  Code,
  Calendar,
  User,
  ArrowRight,
  MessageSquare,
  Send,
  Paperclip,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  fetchPublicBugReports,
  toggleBugUpvote,
  toggleBugDownvote,
  addBugCommentAdmin,
  updateBugStatusAdmin,
  deleteBugReportAdmin,
} from "../services/bugService.js";
import ReportBugModal from "../components/ReportBugModal.jsx";
import PublicNavbar from "../components/PublicNavbar.jsx";

export default function BugTrackerPage() {
  const navigate = useNavigate();
  const {
    isAdminAuthenticated,
    adminRole,
    user,
    adminToken,
    token,
  } = useAuth();

  // Multi-source admin detection
  const isUserAdmin = Boolean(
    isAdminAuthenticated ||
    adminRole === "admin" ||
    user?.role === "admin" ||
    user?.email === "9661346164h@gmail.com"
  );

  const [viewAsPublic, setViewAsPublic] = useState(false);
  const adminModeActive = isUserAdmin && !viewAsPublic;

  // Data State
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Modals & Drawer
  const [isBugModalOpen, setIsBugModalOpen] = useState(false);
  const [selectedBug, setSelectedBug] = useState(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [newAdminComment, setNewAdminComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadBugs = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch only bugs for the bug tracker
      const data = await fetchPublicBugReports({ type: "bug" });
      if (data && data.items) {
        setBugs(data.items);
      }
    } catch (err) {
      console.error("Failed to load bugs:", err);
      setError("Unable to connect to the bug tracking service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBugs();
  }, []);

  const filteredBugs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bugs.filter((item) => {
      if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;
      if (q) {
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        const matchComp = (item.componentLabel || item.componentType || "").toLowerCase().includes(q);
        return matchTitle || matchDesc || matchComp;
      }
      return true;
    });
  }, [bugs, search, selectedCategory, selectedStatus]);

  const metrics = useMemo(() => {
    const total = bugs.length;
    const openCount = bugs.filter((b) => b.status === "under_review").length;
    const inProgress = bugs.filter((b) => b.status === "in_progress" || b.status === "fixed_in_dev").length;
    const resolved = bugs.filter((b) => b.status === "resolved").length;
    return { total, openCount, inProgress, resolved };
  }, [bugs]);

  const handleUpvote = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await toggleBugUpvote(id);
      if (res.success) {
        setBugs((prev) =>
          prev.map((it) =>
            it._id === id
              ? {
                  ...it,
                  upvotes: res.upvotes,
                  hasUpvoted: res.hasUpvoted,
                  downvotes: res.downvotes ?? it.downvotes,
                  hasDownvoted: res.hasDownvoted ?? it.hasDownvoted,
                }
              : it
          )
        );
        if (selectedBug && selectedBug._id === id) {
          setSelectedBug((prev) => ({
            ...prev,
            upvotes: res.upvotes,
            hasUpvoted: res.hasUpvoted,
            downvotes: res.downvotes ?? prev.downvotes,
            hasDownvoted: res.hasDownvoted ?? prev.hasDownvoted,
          }));
        }
      }
    } catch (err) {
      console.error("Upvote failed:", err);
    }
  };

  const handleDownvote = async (id, e) => {
    e.stopPropagation();
    try {
      const res = await toggleBugDownvote(id);
      if (res.success) {
        setBugs((prev) =>
          prev.map((it) =>
            it._id === id
              ? {
                  ...it,
                  downvotes: res.downvotes,
                  hasDownvoted: res.hasDownvoted,
                  upvotes: res.upvotes ?? it.upvotes,
                  hasUpvoted: res.hasUpvoted ?? it.hasUpvoted,
                }
              : it
          )
        );
        if (selectedBug && selectedBug._id === id) {
          setSelectedBug((prev) => ({
            ...prev,
            downvotes: res.downvotes,
            hasDownvoted: res.hasDownvoted,
            upvotes: res.upvotes ?? prev.upvotes,
            hasUpvoted: res.hasUpvoted ?? prev.hasUpvoted,
          }));
        }
      }
    } catch (err) {
      console.error("Downvote failed:", err);
    }
  };

  const handleAddAdminComment = async (e) => {
    e.preventDefault();
    if (!newAdminComment.trim() || !selectedBug) return;
    setCommentSubmitting(true);
    try {
      const tokenToUse = adminToken || token;
      const res = await addBugCommentAdmin(selectedBug._id, newAdminComment.trim(), tokenToUse);
      if (res.success) {
        const updatedComments = res.comments || [...(selectedBug.comments || []), res.comment];
        setBugs((prev) =>
          prev.map((it) =>
            it._id === selectedBug._id ? { ...it, comments: updatedComments } : it
          )
        );
        setSelectedBug((prev) => ({ ...prev, comments: updatedComments }));
        setNewAdminComment("");
      }
    } catch (err) {
      console.error("Failed to add admin comment:", err);
      alert("Failed to submit reply. Please ensure you are logged in as admin.");
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleAdminUpdate = async (id, updates) => {
    setSavingAdmin(true);
    try {
      const tokenToUse = adminToken || token;
      const res = await updateBugStatusAdmin(id, updates, tokenToUse);
      if (res.success) {
        setBugs((prev) =>
          prev.map((it) => (it._id === id ? { ...it, ...updates } : it))
        );
        if (selectedBug && selectedBug._id === id) {
          setSelectedBug((prev) => ({ ...prev, ...updates }));
        }
      }
    } catch (err) {
      console.error("Admin update failed:", err);
      alert("Failed to update bug. Ensure you have admin privileges.");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleAdminDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bug report?")) return;
    try {
      const tokenToUse = adminToken || token;
      await deleteBugReportAdmin(id, tokenToUse);
      setBugs((prev) => prev.filter((it) => it._id !== id));
      if (selectedBug && selectedBug._id === id) {
        setSelectedBug(null);
      }
    } catch (err) {
      console.error("Admin delete failed:", err);
      alert("Failed to delete bug report.");
    }
  };

  const handleExportToGitHub = (item) => {
    const repoMapping = {
      emulator: "https://github.com/OpenHW-Studio/openhw-studio-emulator",
      frontend: "https://github.com/OpenHW-Studio/OpenHW-studio-frontend",
      backend: "https://github.com/OpenHW-Studio/openhw-studio-backend",
    };
    const targetRepoUrl =
      repoMapping[item.targetRepo || "frontend"] || repoMapping.frontend;

    const issueTitle = `[BUG] ${item.title}`;
    const checklist = (item.failingFeatures || []).length > 0
      ? item.failingFeatures.map((f) => `- [ ] ${f}`).join("\n")
      : "";

    const body = `### 🐛 Bug Description\n${item.description}\n\n${item.componentLabel ? `### 🔌 Target Component\n- **Component**: ${item.componentLabel}\n- **Type**: \`${item.componentType}\`` : ""}\n\n${checklist ? `### ⚠️ Failing Features Checklist\n${checklist}\n\n` : ""}${item.stepsToReproduce ? `### 🔄 Steps to Reproduce\n${item.stepsToReproduce}\n\n` : ""}${item.codeSnippet ? `### 💻 Sketch Code\n\`\`\`cpp\n${item.codeSnippet}\n\`\`\`\n\n` : ""}### 🖥️ Diagnostics\n- **Reported via**: OpenHW-Studio Bug Tracker\n- **Reporter**: ${item.reporterName || "Community Member"}\n- **Environment**: ${item.browserInfo || "N/A"}`;

    window.open(`${targetRepoUrl}/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(body)}`, "_blank");
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case "resolved":
        return (
          <span className="bt-status-tag bt-status-resolved">
            <CheckCircle2 size={13} />
            <span>Resolved</span>
          </span>
        );
      case "in_progress":
        return (
          <span className="bt-status-tag bt-status-progress">
            <Clock size={13} />
            <span>In Progress</span>
          </span>
        );
      case "fixed_in_dev":
        return (
          <span className="bt-status-tag bt-status-dev">
            <CheckCircle2 size={13} />
            <span>Fixed in Dev</span>
          </span>
        );
      case "closed":
        return (
          <span className="bt-status-tag bt-status-closed">
            <X size={13} />
            <span>Closed</span>
          </span>
        );
      default:
        return (
          <span className="bt-status-tag bt-status-review">
            <Clock size={13} />
            <span>Under Review</span>
          </span>
        );
    }
  };

  const renderRepoBadge = (repo) => {
    switch (repo) {
      case "emulator":
        return (
          <span className="bt-repo-tag bt-repo-emulator" title="Managed in openhw-studio-emulator">
            <Cpu size={12} />
            <span>Emulator</span>
          </span>
        );
      case "backend":
        return (
          <span className="bt-repo-tag bt-repo-backend" title="Managed in openhw-studio-backend">
            <Server size={12} />
            <span>Backend</span>
          </span>
        );
      default:
        return (
          <span className="bt-repo-tag bt-repo-frontend" title="Managed in OpenHW-studio-frontend">
            <Layers size={12} />
            <span>Frontend</span>
          </span>
        );
    }
  };

  return (
    <div className="bug-tracker-page-root">
      {/* ── NAVBAR ────────────────────────────────────────────────────────── */}
      <PublicNavbar
        links={[
          { label: "Home",               path: "/" },
          { label: "Components Status",  path: "/components-status" },
          { label: "Feedback & Reviews", path: "/feedback" },
        ]}
      />

      {/* ── ADMIN BANNER ──────────────────────────────────────────────────── */}
      {isUserAdmin && (
        <div className="bt-admin-bar">
          <div className="bt-wrap">
            <div className="bt-admin-inner">
              <div className="bt-admin-left">
                <ShieldCheck size={16} className="text-emerald" />
                <span>
                  <strong>Admin Bug Triage Active</strong> &mdash; Danish (PR Manager & Issue Resolver)
                </span>
              </div>
              <div className="bt-admin-right">
                <button
                  type="button"
                  className={`bt-toggle-btn ${viewAsPublic ? "toggle-active" : ""}`}
                  onClick={() => setViewAsPublic(!viewAsPublic)}
                >
                  <Eye size={14} />
                  <span>{viewAsPublic ? "Previewing as Public" : "View as Public"}</span>
                </button>
                <button
                  type="button"
                  className="bt-dashboard-btn"
                  onClick={() => navigate("/admin/dashboard")}
                >
                  <Layers size={14} />
                  <span>Admin Dashboard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="bt-hero">
        <div className="bt-wrap">
          <div className="bt-eyebrow">
            <Bug size={13} />
            <span>Bug & Defect Tracking</span>
          </div>

          <h1 className="bt-title">Hardware & Simulation Bug Tracker</h1>
          <p className="bt-subtitle">
            Report broken simulation pins, AVR8js execution defects, or canvas glitches.
            Our maintainers triage, fix, and update issues here in real time.
          </p>

          <div className="bt-metrics-bar">
            <div className="bt-metric-card">
              <span className="bt-metric-val">{metrics.total}</span>
              <span className="bt-metric-lbl">Total Bugs</span>
            </div>
            <div className="bt-metric-card">
              <span className="bt-metric-val text-rose">{metrics.openCount}</span>
              <span className="bt-metric-lbl">Under Review</span>
            </div>
            <div className="bt-metric-card">
              <span className="bt-metric-val text-amber">{metrics.inProgress}</span>
              <span className="bt-metric-lbl">In Progress / Dev</span>
            </div>
            <div className="bt-metric-card">
              <span className="bt-metric-val text-emerald">{metrics.resolved}</span>
              <span className="bt-metric-lbl">Resolved Bugs</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="bt-main">
        <div className="bt-wrap">
          {/* Controls & Search */}
          <div className="bt-toolbar">
            <div className="bt-search-wrap">
              <Search size={15} className="bt-search-icon" />
              <input
                type="text"
                className="bt-search-input"
                placeholder="Search bugs by component, keyword, or error..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="bt-clear-search"
                  onClick={() => setSearch("")}
                  aria-label="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="bt-filters">
              <select
                className="bt-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="component">Component & Board Emulation</option>
                <option value="simulator_ui">Canvas & Wire Routing</option>
                <option value="compiler_backend">Compiler & Runner</option>
                <option value="general">General Application</option>
              </select>

              <select
                className="bt-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="under_review">Under Review</option>
                <option value="in_progress">In Progress</option>
                <option value="fixed_in_dev">Fixed in Dev</option>
                <option value="resolved">Resolved</option>
              </select>

              <button
                type="button"
                className="btn btn-primary bt-submit-btn"
                onClick={() => setIsBugModalOpen(true)}
              >
                <Plus size={16} />
                <span>Report a Bug</span>
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="bt-state-box">
              <div className="bt-spinner" />
              <p>Loading bug reports from the engineering database...</p>
            </div>
          ) : error ? (
            <div className="bt-state-box">
              <AlertTriangle size={36} className="text-rose" />
              <p>{error}</p>
              <button className="btn btn-ghost" onClick={loadBugs}>
                Retry Loading
              </button>
            </div>
          ) : filteredBugs.length === 0 ? (
            <div className="bt-state-box">
              <Bug size={40} className="empty-bug-icon" />
              <h3>No bugs found</h3>
              <p>No active bugs match your filters, or this issue has not been reported yet.</p>
              <button
                className="btn btn-primary"
                onClick={() => setIsBugModalOpen(true)}
              >
                <Plus size={15} />
                <span>Submit New Bug Report</span>
              </button>
            </div>
          ) : (
            <div className="bt-grid">
              {filteredBugs.map((bug) => (
                <div
                  key={bug._id}
                  className={`bt-card ${bug.status === "resolved" ? "bt-card-resolved" : ""}`}
                  onClick={() => setSelectedBug(bug)}
                >
                  <div className="bt-card-header">
                    <div className="bt-card-tags">
                      <span className="bt-tag bt-tag-bug">
                        <Bug size={12} />
                        <span>Bug</span>
                      </span>

                      {bug.componentLabel && (
                        <span className="bt-tag bt-tag-comp">
                          <Cpu size={12} />
                          <span>{bug.componentLabel}</span>
                        </span>
                      )}

                      {renderRepoBadge(bug.targetRepo)}
                    </div>

                    {renderStatusBadge(bug.status)}
                  </div>

                  <h3 className="bt-card-title">{bug.title}</h3>
                  <p className="bt-card-desc">{bug.description}</p>

                  <div className="bt-card-footer">
                    <div className="bt-meta-user">
                      <User size={12} />
                      <span>{bug.reporterName || "Anonymous"}</span>
                      <span className="bt-dot">&bull;</span>
                      <Calendar size={12} />
                      <span>{new Date(bug.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="bt-card-actions">
                      <button
                        type="button"
                        className={`bt-vote-btn bt-upvote-btn ${bug.hasUpvoted ? "upvoted" : ""}`}
                        onClick={(e) => handleUpvote(bug._id, e)}
                        title="Confirm you experienced this bug"
                      >
                        <ThumbsUp size={13} />
                        <span>{bug.upvotes || 0}</span>
                      </button>

                      <button
                        type="button"
                        className={`bt-vote-btn bt-downvote-btn ${bug.hasDownvoted ? "downvoted" : ""}`}
                        onClick={(e) => handleDownvote(bug._id, e)}
                        title="Downvote"
                      >
                        <ThumbsDown size={13} />
                        <span>{bug.downvotes || 0}</span>
                      </button>

                      {bug.comments?.length > 0 && (
                        <span className="bt-comments-pill" title={`${bug.comments.length} team comment(s)`}>
                          <MessageSquare size={12} />
                          <span>{bug.comments.length}</span>
                        </span>
                      )}

                      {adminModeActive && (
                        <span className="bt-admin-tag">
                          <ShieldCheck size={12} />
                          <span>Triage</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── BUG DETAIL & TRIAGE DRAWER ────────────────────────────────────── */}
      {selectedBug && (
        <div className="bt-overlay" onClick={() => setSelectedBug(null)}>
          <div className="bt-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bt-drawer-header">
              <div className="bt-drawer-title-wrap">
                <div className="bt-drawer-tags">
                  <span className="bt-tag bt-tag-bug">
                    <Bug size={13} />
                    <span>Bug Report</span>
                  </span>
                  {renderRepoBadge(selectedBug.targetRepo)}
                  {renderStatusBadge(selectedBug.status)}
                </div>
                <h2 className="bt-drawer-title">{selectedBug.title}</h2>
                <div className="bt-drawer-sub">
                  <span>Reported by <strong>{selectedBug.reporterName || "Anonymous"}</strong></span>
                  <span>&bull;</span>
                  <span>{new Date(selectedBug.createdAt).toLocaleString()}</span>
                </div>
              </div>
              <button
                className="bt-drawer-close"
                onClick={() => setSelectedBug(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bt-drawer-body">
              {/* ADMIN CONTROLS */}
              {adminModeActive && (
                <div className="bt-admin-triage-panel">
                  <div className="bt-triage-heading">
                    <ShieldCheck size={16} className="text-emerald" />
                    <span>Issue Resolver & Repository Router</span>
                  </div>

                  <div className="bt-triage-grid">
                    <div className="bt-triage-field">
                      <label>Bug Status</label>
                      <select
                        value={selectedBug.status || "under_review"}
                        onChange={(e) =>
                          handleAdminUpdate(selectedBug._id, {
                            status: e.target.value,
                          })
                        }
                        disabled={savingAdmin}
                      >
                        <option value="under_review">Under Review</option>
                        <option value="in_progress">In Progress</option>
                        <option value="fixed_in_dev">Fixed in Dev</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed / Invalid</option>
                      </select>
                    </div>

                    <div className="bt-triage-field">
                      <label>Target Repository</label>
                      <select
                        value={selectedBug.targetRepo || "frontend"}
                        onChange={(e) =>
                          handleAdminUpdate(selectedBug._id, {
                            targetRepo: e.target.value,
                          })
                        }
                        disabled={savingAdmin}
                      >
                        <option value="emulator">openhw-studio-emulator (Hardware/Pins)</option>
                        <option value="frontend">OpenHW-studio-frontend (Canvas/UI)</option>
                        <option value="backend">openhw-studio-backend (Compiler/API)</option>
                      </select>
                    </div>
                  </div>

                  <div className="bt-triage-actions">
                    <button
                      type="button"
                      className="bt-btn-github"
                      onClick={() => handleExportToGitHub(selectedBug)}
                    >
                      <ExternalLink size={14} />
                      <span>Export to GitHub ({selectedBug.targetRepo || "frontend"})</span>
                    </button>

                    <button
                      type="button"
                      className="bt-btn-delete"
                      onClick={() => handleAdminDelete(selectedBug._id)}
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Component Info */}
              {selectedBug.componentLabel && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">
                    <Cpu size={14} />
                    <span>Associated Hardware</span>
                  </h4>
                  <div className="bt-comp-box">
                    <strong>{selectedBug.componentLabel}</strong>
                    <code>{selectedBug.componentType}</code>
                  </div>
                </div>
              )}

              {/* Failing features checklist */}
              {selectedBug.failingFeatures?.length > 0 && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">
                    <AlertTriangle size={14} className="text-rose" />
                    <span>Failing Hardware Features</span>
                  </h4>
                  <ul className="bt-features-list">
                    {selectedBug.failingFeatures.map((f, i) => (
                      <li key={i}>
                        <CheckCircle2 size={13} className="text-rose" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Description */}
              <div className="bt-section">
                <h4 className="bt-sec-title">Description</h4>
                <div className="bt-content-box">
                  <p>{selectedBug.description}</p>
                </div>
              </div>

              {/* Steps to reproduce */}
              {selectedBug.stepsToReproduce && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">Steps to Reproduce</h4>
                  <div className="bt-content-box">
                    <pre>{selectedBug.stepsToReproduce}</pre>
                  </div>
                </div>
              )}

              {/* Code Snippet */}
              {selectedBug.codeSnippet && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">
                    <Code size={14} />
                    <span>Attached Sketch Code</span>
                  </h4>
                  <div className="bt-code-box">
                    <pre><code>{selectedBug.codeSnippet}</code></pre>
                  </div>
                </div>
              )}

              {/* Attached Screenshot / Circuit Image */}
              {selectedBug.attachmentUrl && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">
                    <Paperclip size={14} />
                    <span>Attachment / Screenshot</span>
                  </h4>
                  <div className="bt-attachment-view">
                    {selectedBug.attachmentUrl.startsWith("data:image/") || selectedBug.attachmentUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                      <a href={selectedBug.attachmentUrl} target="_blank" rel="noopener noreferrer">
                        <img src={selectedBug.attachmentUrl} alt="Circuit bug attachment" className="bt-attachment-img" />
                      </a>
                    ) : (
                      <a href={selectedBug.attachmentUrl} target="_blank" rel="noopener noreferrer" className="bt-attachment-file-btn">
                        <ExternalLink size={14} />
                        <span>Open Document Attachment</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Maintainer / Staff Comments Section */}
              <div className="bt-section">
                <h4 className="bt-sec-title">
                  <MessageSquare size={14} />
                  <span>Engineering & Triage Updates ({selectedBug.comments?.length || 0})</span>
                </h4>

                {selectedBug.comments?.length > 0 ? (
                  <div className="bt-comments-list">
                    {selectedBug.comments.map((cm, idx) => (
                      <div key={idx} className="bt-comment-card">
                        <div className="bt-comment-header">
                          <div className="bt-comment-author">
                            <ShieldCheck size={13} className="text-emerald" />
                            <strong>{cm.authorName || "OpenHW Team"}</strong>
                            <span className="bt-staff-badge">Staff</span>
                          </div>
                          <span className="bt-comment-time">
                            {new Date(cm.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="bt-comment-text">{cm.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="bt-no-comments">No triage notes from engineering yet.</p>
                )}

                {/* Admin-only comment input */}
                {adminModeActive && (
                  <form onSubmit={handleAddAdminComment} className="bt-comment-form">
                    <textarea
                      className="bt-comment-input"
                      rows={3}
                      placeholder="Add an official engineering comment or workaround..."
                      value={newAdminComment}
                      onChange={(e) => setNewAdminComment(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="bt-comment-submit-btn"
                      disabled={commentSubmitting || !newAdminComment.trim()}
                    >
                      <Send size={13} />
                      <span>{commentSubmitting ? "Posting..." : "Post Official Update"}</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Diagnostics */}
              {adminModeActive && (
                <div className="bt-section">
                  <h4 className="bt-sec-title">
                    <Server size={14} />
                    <span>Diagnostics (Admin Only)</span>
                  </h4>
                  <div className="bt-diag-box">
                    <div><strong>Reporter Email:</strong> {selectedBug.reporterEmail || "Anonymous"}</div>
                    <div><strong>User Agent:</strong> {selectedBug.browserInfo || "N/A"}</div>
                    <div><strong>Platform:</strong> {selectedBug.osInfo || "N/A"}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bt-drawer-footer">
              <div className="bt-footer-votes">
                <button
                  type="button"
                  className={`bt-footer-vote-btn ${selectedBug.hasUpvoted ? "upvoted" : ""}`}
                  onClick={(e) => handleUpvote(selectedBug._id, e)}
                  title="Confirm bug"
                >
                  <ThumbsUp size={14} />
                  <span>{selectedBug.upvotes || 0} Confirmations</span>
                </button>

                <button
                  type="button"
                  className={`bt-footer-vote-btn ${selectedBug.hasDownvoted ? "downvoted" : ""}`}
                  onClick={(e) => handleDownvote(selectedBug._id, e)}
                  title="Downvote"
                >
                  <ThumbsDown size={14} />
                  <span>{selectedBug.downvotes || 0} Downvotes</span>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedBug(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Bug Submission Modal */}
      <ReportBugModal
        isOpen={isBugModalOpen}
        onClose={() => setIsBugModalOpen(false)}
        onSuccess={() => loadBugs()}
      />

      <style>{BUG_TRACKER_CSS}</style>
    </div>
  );
}

const BUG_TRACKER_CSS = `
  .bug-tracker-page-root {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding-bottom: 80px;
    position: relative;
  }

  .bt-wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Admin Bar */
  .bt-admin-bar {
    background: rgba(16, 185, 129, 0.08);
    border-bottom: 1px solid rgba(16, 185, 129, 0.22);
    padding: 10px 0;
    font-size: 13px;
  }
  .bt-admin-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .bt-admin-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #10b981;
  }
  .bt-admin-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .bt-toggle-btn, .bt-dashboard-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 12px;
    border-radius: 6px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .bt-toggle-btn:hover, .bt-dashboard-btn:hover { border-color: #10b981; }
  .toggle-active { background: #10b981; color: #070b14; border-color: #10b981; }

  /* Hero */
  .bt-hero {
    padding: 50px 0 36px;
    text-align: center;
    border-bottom: 1px solid var(--border);
    background: radial-gradient(circle at 50% 0%, rgba(239, 68, 68, 0.06) 0%, transparent 60%);
  }
  .bt-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px;
    border-radius: 99px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.25);
    color: #ef4444;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }
  .bt-title {
    font-size: clamp(26px, 3.8vw, 42px);
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 12px;
  }
  .bt-subtitle {
    font-size: 15.5px;
    color: var(--text2);
    max-width: 640px;
    margin: 0 auto 28px;
    line-height: 1.6;
  }

  .bt-metrics-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .bt-metric-card {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .bt-metric-val {
    font-size: 16px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .bt-metric-lbl {
    font-size: 12.5px;
    color: var(--text2);
  }

  /* Main & Toolbar */
  .bt-main { padding: 30px 0; }
  .bt-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .bt-search-wrap {
    flex: 1;
    min-width: 280px;
    position: relative;
  }
  .bt-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text2);
  }
  .bt-search-input {
    width: 100%;
    padding: 10px 38px 10px 38px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13.5px;
    outline: none;
  }
  .bt-search-input:focus { border-color: var(--accent, #38bdf8); }
  .bt-clear-search {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text2);
    cursor: pointer;
  }
  .bt-filters {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .bt-select {
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }
  .bt-submit-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 13.5px;
    background: #ef4444;
    color: white;
  }
  .bt-submit-btn:hover { filter: brightness(1.1); }

  /* Grid & Cards (3 columns) */
  .bt-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 1060px) {
    .bt-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 680px) {
    .bt-grid { grid-template-columns: 1fr; }
  }

  .bt-card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    overflow: hidden;
  }
  .bt-card:hover {
    transform: translateY(-3px);
    border-color: #ef4444;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
  }
  .bt-card-resolved {
    opacity: 0.85;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .bt-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  .bt-card-tags {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .bt-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 700;
  }
  .bt-tag-bug {
    background: rgba(239, 68, 68, 0.12);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }
  .bt-tag-comp {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 11.5px;
  }

  .bt-repo-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .bt-repo-emulator {
    background: rgba(168, 85, 247, 0.1);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.25);
  }
  .bt-repo-frontend {
    background: rgba(59, 130, 246, 0.1);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.25);
  }
  .bt-repo-backend {
    background: rgba(245, 158, 11, 0.1);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .bt-status-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
  }
  .bt-status-review {
    background: rgba(148, 163, 184, 0.12);
    color: #94a3b8;
    border: 1px solid rgba(148, 163, 184, 0.3);
  }
  .bt-status-progress {
    background: rgba(245, 158, 11, 0.12);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .bt-status-dev {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }
  .bt-status-resolved {
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }
  .bt-status-closed {
    background: rgba(239, 68, 68, 0.08);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }

  .bt-card-title {
    margin: 0 0 8px;
    font-size: 15.5px;
    font-weight: 700;
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    line-height: 1.35;
  }
  .bt-card-desc {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.5;
    margin: 0 0 16px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    flex: 1;
  }

  .bt-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .bt-meta-user {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text2);
  }
  .bt-dot { opacity: 0.5; }

  .bt-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bt-upvote-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .bt-upvote-btn:hover { color: #ef4444; border-color: #ef4444; }
  .bt-upvote-btn.upvoted {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }
  .bt-admin-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.12);
    color: #10b981;
    font-size: 11px;
    font-weight: 700;
  }

  /* Drawer */
  .bt-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: flex-end;
    animation: btFadeIn 0.2s ease;
  }
  @keyframes btFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .bt-drawer {
    width: 100%;
    max-width: 560px;
    height: 100vh;
    background: var(--bg2, #0d1525);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    animation: btSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes btSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .bt-drawer-header {
    padding: 22px 26px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .bt-drawer-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .bt-drawer-title {
    font-size: 20px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 6px;
  }
  .bt-drawer-sub {
    font-size: 12.5px;
    color: var(--text2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bt-drawer-close {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    cursor: pointer;
  }
  .bt-drawer-close:hover { color: var(--text); border-color: var(--border2); }

  .bt-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 26px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2) transparent;
  }
  .bt-drawer-body::-webkit-scrollbar { width: 6px; }
  .bt-drawer-body::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  /* Triage Panel */
  .bt-admin-triage-panel {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bt-triage-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #10b981;
    font-weight: 700;
    font-size: 13.5px;
  }
  .bt-triage-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 480px) { .bt-triage-grid { grid-template-columns: 1fr; } }
  .bt-triage-field label {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text2);
    margin-bottom: 4px;
  }
  .bt-triage-field select {
    width: 100%;
    padding: 7px 10px;
    border-radius: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 12.5px;
    outline: none;
  }
  .bt-triage-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 6px;
    border-top: 1px solid rgba(16, 185, 129, 0.15);
  }
  .bt-btn-github {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    background: #10b981;
    color: #070b14;
    border: none;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .bt-btn-github:hover { filter: brightness(1.1); }
  .bt-btn-delete {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    border-radius: 8px;
    background: transparent;
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .bt-btn-delete:hover { background: rgba(239, 68, 68, 0.1); }

  .bt-sec-title {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 8px;
  }
  .bt-comp-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.2);
    font-size: 13px;
  }
  .bt-comp-box code {
    background: rgba(255, 255, 255, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11.5px;
  }
  .bt-features-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bt-features-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--text2);
  }
  .bt-content-box, .bt-code-box, .bt-diag-box {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text);
  }
  .bt-content-box p, .bt-content-box pre { margin: 0; white-space: pre-wrap; font-family: inherit; }
  .bt-code-box pre code { font-family: monospace; font-size: 12px; }
  .bt-diag-box {
    font-size: 12px;
    color: var(--text2);
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(0, 0, 0, 0.3);
  }

  .bt-drawer-footer {
    padding: 16px 26px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .bt-footer-votes {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .bt-footer-vote-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .bt-footer-vote-btn:hover {
    border-color: var(--border2);
    background: rgba(255, 255, 255, 0.04);
  }
  .bt-footer-vote-btn.upvoted {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }
  .bt-footer-vote-btn.downvoted {
    background: rgba(148, 163, 184, 0.15);
    border-color: #94a3b8;
    color: var(--text2);
  }

  .bt-vote-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 9px;
    border-radius: 6px;
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .bt-vote-btn:hover {
    border-color: var(--border2);
    color: var(--text);
  }
  .bt-upvote-btn.upvoted {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }
  .bt-downvote-btn.downvoted {
    background: rgba(148, 163, 184, 0.15);
    border-color: #94a3b8;
    color: var(--text2);
  }

  .bt-comments-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
    font-size: 11px;
    font-weight: 700;
  }

  /* Drawer Attachments */
  .bt-attachment-view {
    margin-top: 6px;
  }
  .bt-attachment-img {
    max-width: 100%;
    max-height: 240px;
    border-radius: 8px;
    border: 1px solid var(--border);
    object-fit: cover;
    transition: transform 0.2s;
  }
  .bt-attachment-img:hover {
    transform: scale(1.02);
  }
  .bt-attachment-file-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    color: #38bdf8;
    text-decoration: none;
    font-size: 12.5px;
    font-weight: 600;
  }

  /* Drawer Comments */
  .bt-comments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }
  .bt-comment-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .bt-comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .bt-comment-author {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
  }
  .bt-staff-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .bt-comment-time {
    font-size: 11px;
    color: var(--text3);
  }
  .bt-comment-text {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.5;
    margin: 0;
  }
  .bt-no-comments {
    font-size: 12.5px;
    color: var(--text3);
    margin: 4px 0 10px;
  }
  .bt-comment-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .bt-comment-input {
    width: 100%;
    padding: 10px 12px;
    background: rgba(0, 0, 0, 0.25);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
    resize: vertical;
    outline: none;
    font-family: inherit;
  }
  .bt-comment-input:focus {
    border-color: #ef4444;
  }
  .bt-comment-submit-btn {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 7px;
    background: #ef4444;
    color: #fff;
    border: none;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s;
  }
  .bt-comment-submit-btn:hover {
    filter: brightness(1.1);
  }
  .bt-comment-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* States */
  .bt-state-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 64px 24px;
    background: var(--card);
    border: 1px dashed var(--border);
    border-radius: 16px;
    margin: 20px 0;
  }
  .bt-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: #ef4444;
    border-radius: 50%;
    animation: btSpin 0.8s linear infinite;
    margin-bottom: 14px;
  }
  .empty-bug-icon {
    display: block;
    color: var(--text2);
    margin: 0 auto 16px;
    opacity: 0.65;
  }
  .bt-state-box h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }
  .bt-state-box p {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text2);
    max-width: 480px;
  }
`;
