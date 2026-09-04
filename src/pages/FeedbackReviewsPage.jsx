import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Star,
  Lightbulb,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  Search,
  Plus,
  X,
  ShieldCheck,
  Eye,
  Trash2,
  Calendar,
  User,
  ArrowRight,
  MessageSquare,
  Sparkles,
  Send,
  Paperclip,
  ExternalLink,
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
import SubmitFeedbackModal from "../components/SubmitFeedbackModal.jsx";
import PublicNavbar from "../components/PublicNavbar.jsx";

export default function FeedbackReviewsPage() {
  const navigate = useNavigate();
  const {
    isAuthenticated,
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Tabs: 'reviews' | 'features' | 'completed' (User reviews first by default)
  const [activeTab, setActiveTab] = useState("reviews");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");

  // Modals & Drawer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInitialType, setModalInitialType] = useState("review");
  const [selectedItem, setSelectedItem] = useState(null);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [newAdminComment, setNewAdminComment] = useState("");
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadFeedback = async () => {
    setLoading(true);
    setError("");
    try {
      // Fetch public items (features and reviews)
      const data = await fetchPublicBugReports();
      if (data && data.items) {
        // Exclude technical bugs from this page
        setItems(data.items.filter((i) => i.type === "feature" || i.type === "review"));
      }
    } catch (err) {
      console.error("Failed to load feedback:", err);
      setError("Unable to connect to the feedback service.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, []);

  // Filtered items based on activeTab
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (activeTab === "features") {
        if (item.type !== "feature") return false;
        if (item.status === "resolved") return false;
      } else if (activeTab === "reviews") {
        if (item.type !== "review") return false;
      } else if (activeTab === "completed") {
        if (item.status !== "resolved") return false;
      }

      if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

      if (q) {
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        const matchUser = (item.reporterName || "").toLowerCase().includes(q);
        return matchTitle || matchDesc || matchUser;
      }
      return true;
    });
  }, [items, activeTab, search, selectedCategory]);

  // Metrics
  const metrics = useMemo(() => {
    const features = items.filter((i) => i.type === "feature" && i.status !== "resolved").length;
    const reviews = items.filter((i) => i.type === "review");
    const completed = items.filter((i) => i.status === "resolved").length;

    const totalStars = reviews.reduce((sum, r) => sum + (r.rating || 5), 0);
    const avgRating = reviews.length > 0 ? (totalStars / reviews.length).toFixed(1) : "5.0";

    return { features, reviewsCount: reviews.length, completed, avgRating };
  }, [items]);

  const handleUpvote = async (id, e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      if (window.confirm("Please log in to vote for community features. Go to login page?")) {
        navigate("/login?returnTo=/feedback", { state: { from: "/feedback" } });
      }
      return;
    }
    try {
      const res = await toggleBugUpvote(id);
      if (res.success) {
        setItems((prev) =>
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
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem((prev) => ({
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
    if (!isAuthenticated) {
      if (window.confirm("You need to sign in to vote. Go to login?")) {
        navigate("/login?returnTo=/feedback", { state: { from: "/feedback" } });
      }
      return;
    }
    try {
      const res = await toggleBugDownvote(id);
      if (res.success) {
        setItems((prev) =>
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
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem((prev) => ({
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
    if (!newAdminComment.trim() || !selectedItem) return;
    setCommentSubmitting(true);
    try {
      const tokenToUse = adminToken || token;
      const res = await addBugCommentAdmin(selectedItem._id, newAdminComment.trim(), tokenToUse);
      if (res.success) {
        const updatedComments = res.comments || [...(selectedItem.comments || []), res.comment];
        setItems((prev) =>
          prev.map((it) =>
            it._id === selectedItem._id ? { ...it, comments: updatedComments } : it
          )
        );
        setSelectedItem((prev) => ({ ...prev, comments: updatedComments }));
        setNewAdminComment("");
      }
    } catch (err) {
      console.error("Failed to add admin comment:", err);
      alert("Failed to submit comment. Please ensure you are logged in as admin.");
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
        setItems((prev) =>
          prev.map((it) => (it._id === id ? { ...it, ...updates } : it))
        );
        if (selectedItem && selectedItem._id === id) {
          setSelectedItem((prev) => ({ ...prev, ...updates }));
        }
      }
    } catch (err) {
      console.error("Admin update failed:", err);
      alert("Failed to update status.");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleAdminDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this submission?")) return;
    try {
      const tokenToUse = adminToken || token;
      await deleteBugReportAdmin(id, tokenToUse);
      setItems((prev) => prev.filter((it) => it._id !== id));
      if (selectedItem && selectedItem._id === id) {
        setSelectedItem(null);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete entry.");
    }
  };

  const renderStars = (rating) => {
    const r = Math.min(5, Math.max(1, Number(rating) || 5));
    return (
      <div className="star-rating-display">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            size={14}
            className={s <= r ? "star-solid" : "star-dim"}
          />
        ))}
        <span className="rating-num-label">{r}.0</span>
      </div>
    );
  };

  const renderFeatureStatus = (status) => {
    switch (status) {
      case "resolved":
        return (
          <span className="fr-status-tag fr-status-done">
            <CheckCircle2 size={12} />
            <span>Shipped</span>
          </span>
        );
      case "in_progress":
        return (
          <span className="fr-status-tag fr-status-progress">
            <Clock size={12} />
            <span>In Development</span>
          </span>
        );
      case "fixed_in_dev":
        return (
          <span className="fr-status-tag fr-status-planned">
            <Sparkles size={12} />
            <span>Planned</span>
          </span>
        );
      default:
        return (
          <span className="fr-status-tag fr-status-review">
            <Clock size={12} />
            <span>Under Review</span>
          </span>
        );
    }
  };

  return (
    <div className="feedback-reviews-root">
      {/* ── NAVBAR ────────────────────────────────────────────────────── */}
      <PublicNavbar
        links={[
          { label: "Home",              path: "/" },
          { label: "Components Status", path: "/components-status" },
          { label: "Bug Tracker",       path: "/bugs" },
        ]}
      />

      {/* ── ADMIN BANNER ──────────────────────────────────────────────────── */}
      {isUserAdmin && (
        <div className="fr-admin-bar">
          <div className="fr-wrap">
            <div className="fr-admin-inner">
              <div className="fr-admin-left">
                <ShieldCheck size={16} className="text-emerald" />
                <span>
                  <strong>Admin Feedback Manager Active</strong> &mdash; Danish (Issue Resolver)
                </span>
              </div>
              <div className="fr-admin-right">
                <button
                  type="button"
                  className={`fr-toggle-btn ${viewAsPublic ? "toggle-active" : ""}`}
                  onClick={() => setViewAsPublic(!viewAsPublic)}
                >
                  <Eye size={14} />
                  <span>{viewAsPublic ? "Previewing as Public" : "View as Public"}</span>
                </button>
                <button
                  type="button"
                  className="fr-dashboard-btn"
                  onClick={() => navigate("/admin/dashboard")}
                >
                  <span>Admin Dashboard</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <header className="fr-hero">
        <div className="fr-wrap">
          <div className="fr-eyebrow">
            <MessageSquare size={13} />
            <span>Community Voice & Roadmap</span>
          </div>

          <h1 className="fr-title">Reviews & Feature Requests</h1>
          <p className="fr-subtitle">
            Share your experience using OpenHW-Studio, leave a rating, or vote on hardware
            boards and simulator features you want our team to build next.
          </p>

          <div className="fr-metrics-bar">
            <div className="fr-metric-card">
              <Star size={16} className="text-gold" />
              <span className="fr-metric-val">{metrics.avgRating} / 5</span>
              <span className="fr-metric-lbl">Avg User Rating</span>
            </div>
            <div className="fr-metric-card">
              <Lightbulb size={16} className="text-sky" />
              <span className="fr-metric-val">{metrics.features}</span>
              <span className="fr-metric-lbl">Feature Ideas</span>
            </div>
            <div className="fr-metric-card">
              <User size={16} className="text-purple" />
              <span className="fr-metric-val">{metrics.reviewsCount}</span>
              <span className="fr-metric-lbl">Reviews</span>
            </div>
            <div className="fr-metric-card">
              <CheckCircle2 size={16} className="text-emerald" />
              <span className="fr-metric-val">{metrics.completed}</span>
              <span className="fr-metric-lbl">Shipped Features</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <main className="fr-main">
        <div className="fr-wrap">
          {/* Controls Bar: Tabs + Action Buttons */}
          <div className="fr-toolbar">
            <div className="fr-tabs">
              <button
                className={`fr-tab-btn ${activeTab === "reviews" ? "fr-tab-active" : ""}`}
                onClick={() => setActiveTab("reviews")}
              >
                <Star size={14} />
                <span>User Reviews ({metrics.reviewsCount})</span>
              </button>
              <button
                className={`fr-tab-btn ${activeTab === "features" ? "fr-tab-active" : ""}`}
                onClick={() => setActiveTab("features")}
              >
                <Lightbulb size={14} />
                <span>Feature Requests ({metrics.features})</span>
              </button>
              <button
                className={`fr-tab-btn ${activeTab === "completed" ? "fr-tab-active" : ""}`}
                onClick={() => setActiveTab("completed")}
              >
                <CheckCircle2 size={14} />
                <span>Shipped Roadmap ({metrics.completed})</span>
              </button>
            </div>

            <div className="fr-actions-right">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setModalInitialType("review");
                  setIsModalOpen(true);
                }}
              >
                <Star size={14} />
                <span>Leave a Review</span>
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setModalInitialType("feature");
                  setIsModalOpen(true);
                }}
              >
                <Plus size={15} />
                <span>Request Feature</span>
              </button>
            </div>
          </div>

          {/* Search Row */}
          <div className="fr-filter-bar">
            <div className="fr-search-wrap">
              <Search size={15} className="fr-search-icon" />
              <input
                type="text"
                className="fr-search-input"
                placeholder={
                  activeTab === "reviews"
                    ? "Search reviews by keyword, role, or educator..."
                    : "Search feature ideas, boards, or peripherals..."
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  className="fr-clear-btn"
                  onClick={() => setSearch("")}
                  aria-label="Clear"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {activeTab === "features" && (
              <select
                className="fr-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="all">All Categories</option>
                <option value="component">New Microcontrollers & Boards</option>
                <option value="general">New Sensors & Peripherals</option>
                <option value="simulator_ui">Simulator Canvas & Wire Routing</option>
                <option value="compiler_backend">Libraries & Code Autocomplete</option>
              </select>
            )}
          </div>

          {/* Cards Grid */}
          {loading ? (
            <div className="fr-state-box">
              <div className="fr-spinner" />
              <p>Loading community feedback and reviews...</p>
            </div>
          ) : error ? (
            <div className="fr-state-box">
              <p>{error}</p>
              <button className="btn btn-ghost" onClick={loadFeedback}>
                Retry Loading
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="fr-state-box">
              {activeTab === "reviews" ? (
                <>
                  <Star size={40} className="empty-icon text-gold" />
                  <h3>No reviews yet</h3>
                  <p>Be the first to share your experience using OpenHW-Studio!</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setModalInitialType("review");
                      setIsModalOpen(true);
                    }}
                  >
                    <Star size={14} />
                    Leave the First Review
                  </button>
                </>
              ) : (
                <>
                  <Lightbulb size={40} className="empty-icon text-sky" />
                  <h3>No feature ideas found</h3>
                  <p>Have an idea for a new board or sensor? Propose it to the community!</p>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setModalInitialType("feature");
                      setIsModalOpen(true);
                    }}
                  >
                    <Plus size={14} />
                    Submit Feature Request
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="fr-grid">
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className="fr-card"
                  onClick={() => setSelectedItem(item)}
                >
                  {/* Top Row */}
                  <div className="fr-card-header">
                    {item.type === "review" ? (
                      <div className="fr-review-top">
                        {renderStars(item.rating)}
                        <span className="fr-role-pill">{item.userRole || "Maker"}</span>
                      </div>
                    ) : (
                      <div className="fr-feature-top">
                        <span className="fr-tag-feature">
                          <Lightbulb size={12} />
                          <span>Feature Idea</span>
                        </span>
                        {renderFeatureStatus(item.status)}
                      </div>
                    )}
                  </div>

                  <h3 className="fr-card-title">{item.title}</h3>
                  <p className="fr-card-desc">{item.description}</p>

                  <div className="fr-card-footer">
                    <div className="fr-meta-user">
                      <User size={12} />
                      <span>{item.reporterName || "Community Member"}</span>
                      <span className="fr-dot">&bull;</span>
                      <Calendar size={12} />
                      <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    </div>

                    <div className="fr-card-actions">
                      <button
                        type="button"
                        className={`fr-vote-btn fr-upvote-btn ${item.hasUpvoted ? "upvoted" : ""}`}
                        onClick={(e) => handleUpvote(item._id, e)}
                        title="Upvote"
                      >
                        <ThumbsUp size={13} />
                        <span>{item.upvotes || 0}</span>
                      </button>

                      <button
                        type="button"
                        className={`fr-vote-btn fr-downvote-btn ${item.hasDownvoted ? "downvoted" : ""}`}
                        onClick={(e) => handleDownvote(item._id, e)}
                        title="Downvote"
                      >
                        <ThumbsDown size={13} />
                        <span>{item.downvotes || 0}</span>
                      </button>

                      {item.comments?.length > 0 && (
                        <span className="fr-comments-pill" title={`${item.comments.length} staff comment(s)`}>
                          <MessageSquare size={12} />
                          <span>{item.comments.length}</span>
                        </span>
                      )}

                      {adminModeActive && (
                        <span className="fr-admin-pill">
                          <ShieldCheck size={12} />
                          <span>Admin</span>
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

      {/* ── DETAILS DRAWER ────────────────────────────────────────────────── */}
      {selectedItem && (
        <div className="fr-overlay" onClick={() => setSelectedItem(null)}>
          <div className="fr-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="fr-drawer-header">
              <div className="fr-drawer-title-wrap">
                {selectedItem.type === "review" ? (
                  <div className="fr-review-drawer-meta">
                    {renderStars(selectedItem.rating)}
                    <span className="fr-role-pill">{selectedItem.userRole || "Maker"}</span>
                  </div>
                ) : (
                  <div className="fr-feature-drawer-meta">
                    <span className="fr-tag-feature">
                      <Lightbulb size={13} />
                      <span>Feature Request</span>
                    </span>
                    {renderFeatureStatus(selectedItem.status)}
                  </div>
                )}

                <h2 className="fr-drawer-title">{selectedItem.title}</h2>
                <div className="fr-drawer-sub">
                  <span>Submitted by <strong>{selectedItem.reporterName || "Community Member"}</strong></span>
                  <span>&bull;</span>
                  <span>{new Date(selectedItem.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <button
                className="fr-drawer-close"
                onClick={() => setSelectedItem(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="fr-drawer-body">
              {/* ADMIN CONTROLS */}
              {adminModeActive && (
                <div className="fr-admin-panel">
                  <div className="fr-admin-heading">
                    <ShieldCheck size={16} className="text-emerald" />
                    <span>Admin Controls</span>
                  </div>

                  {selectedItem.type === "feature" && (
                    <div className="fr-admin-field">
                      <label>Feature Roadmap Status</label>
                      <select
                        value={selectedItem.status || "under_review"}
                        onChange={(e) =>
                          handleAdminUpdate(selectedItem._id, {
                            status: e.target.value,
                          })
                        }
                        disabled={savingAdmin}
                      >
                        <option value="under_review">Under Review / Idea</option>
                        <option value="fixed_in_dev">Planned for Next Release</option>
                        <option value="in_progress">In Active Development</option>
                        <option value="resolved">Shipped & Completed</option>
                        <option value="closed">Declined</option>
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    className="fr-btn-delete"
                    onClick={() => handleAdminDelete(selectedItem._id)}
                  >
                    <Trash2 size={14} />
                    <span>Delete Submission</span>
                  </button>
                </div>
              )}

              <div className="fr-drawer-section">
                <h4 className="fr-sec-title">
                  {selectedItem.type === "review" ? "Review & Feedback Details" : "Feature Details & Use Case"}
                </h4>
                <div className="fr-content-box">
                  <p>{selectedItem.description}</p>
                </div>
              </div>

              {/* Attached Screenshot / Circuit Spec */}
              {selectedItem.attachmentUrl && (
                <div className="fr-drawer-section">
                  <h4 className="fr-sec-title">
                    <Paperclip size={14} />
                    <span>Attachment / Screenshot</span>
                  </h4>
                  <div className="fr-attachment-view">
                    {selectedItem.attachmentUrl.startsWith("data:image/") || selectedItem.attachmentUrl.match(/\.(jpeg|jpg|png|gif|webp)$/i) ? (
                      <a href={selectedItem.attachmentUrl} target="_blank" rel="noopener noreferrer">
                        <img src={selectedItem.attachmentUrl} alt="Submission attachment" className="fr-attachment-img" />
                      </a>
                    ) : (
                      <a href={selectedItem.attachmentUrl} target="_blank" rel="noopener noreferrer" className="fr-attachment-file-btn">
                        <ExternalLink size={14} />
                        <span>Open Document Attachment</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Staff / Admin Comments Section */}
              <div className="fr-drawer-section">
                <h4 className="fr-sec-title">
                  <MessageSquare size={14} />
                  <span>Maintainer & Staff Responses ({selectedItem.comments?.length || 0})</span>
                </h4>
                
                {selectedItem.comments?.length > 0 ? (
                  <div className="fr-comments-list">
                    {selectedItem.comments.map((cm, idx) => (
                      <div key={idx} className="fr-comment-card">
                        <div className="fr-comment-header">
                          <div className="fr-comment-author">
                            <ShieldCheck size={13} className="text-emerald" />
                            <strong>{cm.authorName || "OpenHW Team"}</strong>
                            <span className="fr-staff-badge">Staff</span>
                          </div>
                          <span className="fr-comment-time">
                            {new Date(cm.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="fr-comment-text">{cm.text}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="fr-no-comments">No official team responses yet.</p>
                )}

                {/* Admin-only comment input */}
                {adminModeActive && (
                  <form onSubmit={handleAddAdminComment} className="fr-comment-form">
                    <textarea
                      className="fr-comment-input"
                      rows={3}
                      placeholder="Add an official staff reply or status update..."
                      value={newAdminComment}
                      onChange={(e) => setNewAdminComment(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="fr-comment-submit-btn"
                      disabled={commentSubmitting || !newAdminComment.trim()}
                    >
                      <Send size={13} />
                      <span>{commentSubmitting ? "Posting..." : "Post Official Reply"}</span>
                    </button>
                  </form>
                )}
              </div>

              {adminModeActive && selectedItem.reporterEmail && (
                <div className="fr-drawer-section">
                  <h4 className="fr-sec-title">Private Submitter Info (Admin Only)</h4>
                  <div className="fr-diag-box">
                    <div><strong>Email:</strong> {selectedItem.reporterEmail}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="fr-drawer-footer">
              <div className="fr-footer-votes">
                <button
                  type="button"
                  className={`fr-footer-vote-btn ${selectedItem.hasUpvoted ? "upvoted" : ""}`}
                  onClick={(e) => handleUpvote(selectedItem._id, e)}
                  title="Upvote"
                >
                  <ThumbsUp size={14} />
                  <span>{selectedItem.upvotes || 0} Upvotes</span>
                </button>

                <button
                  type="button"
                  className={`fr-footer-vote-btn ${selectedItem.hasDownvoted ? "downvoted" : ""}`}
                  onClick={(e) => handleDownvote(selectedItem._id, e)}
                  title="Downvote"
                >
                  <ThumbsDown size={14} />
                  <span>{selectedItem.downvotes || 0} Downvotes</span>
                </button>
              </div>

              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedItem(null)}
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for reviews and features */}
      <SubmitFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialType={modalInitialType}
        onSuccess={() => loadFeedback()}
      />

      <style>{FEEDBACK_REVIEWS_CSS}</style>
    </div>
  );
}

const FEEDBACK_REVIEWS_CSS = `
  .feedback-reviews-root {
    min-height: 100vh;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding-bottom: 80px;
    position: relative;
  }

  .fr-wrap {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* Admin Bar */
  .fr-admin-bar {
    background: rgba(16, 185, 129, 0.08);
    border-bottom: 1px solid rgba(16, 185, 129, 0.22);
    padding: 10px 0;
    font-size: 13px;
  }
  .fr-admin-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .fr-admin-left {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #10b981;
  }
  .fr-admin-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .fr-toggle-btn, .fr-dashboard-btn {
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
  .fr-toggle-btn:hover, .fr-dashboard-btn:hover { border-color: #10b981; }
  .toggle-active { background: #10b981; color: #070b14; border-color: #10b981; }

  /* Hero */
  .fr-hero {
    padding: 50px 0 36px;
    text-align: center;
    border-bottom: 1px solid var(--border);
    background: radial-gradient(circle at 50% 0%, rgba(245, 158, 11, 0.07) 0%, transparent 60%);
  }
  .fr-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 14px;
    border-radius: 99px;
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25);
    color: #f59e0b;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 14px;
  }
  .fr-title {
    font-size: clamp(26px, 3.8vw, 42px);
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 12px;
  }
  .fr-subtitle {
    font-size: 15.5px;
    color: var(--text2);
    max-width: 640px;
    margin: 0 auto 28px;
    line-height: 1.6;
  }

  .fr-metrics-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .fr-metric-card {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 9px 18px;
    border-radius: 12px;
    background: var(--card);
    border: 1px solid var(--border);
  }
  .fr-metric-val {
    font-size: 16px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .fr-metric-lbl {
    font-size: 12.5px;
    color: var(--text2);
  }

  /* Main & Toolbar */
  .fr-main { padding: 30px 0; }
  .fr-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .fr-tabs {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
  }
  .fr-tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    background: transparent;
    border: 1px solid transparent;
    color: var(--text2);
    font-size: 13.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .fr-tab-btn:hover { background: var(--card); color: var(--text); }
  .fr-tab-active {
    background: var(--card);
    border-color: var(--border);
    color: #f59e0b;
  }
  .fr-actions-right {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  /* Filter */
  .fr-filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }
  .fr-search-wrap {
    flex: 1;
    min-width: 280px;
    position: relative;
  }
  .fr-search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text2);
  }
  .fr-search-input {
    width: 100%;
    padding: 10px 38px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13.5px;
    outline: none;
  }
  .fr-search-input:focus { border-color: var(--accent, #38bdf8); }
  .fr-clear-btn {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: transparent;
    border: none;
    color: var(--text2);
    cursor: pointer;
  }
  .fr-select {
    padding: 9px 12px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13px;
    outline: none;
    cursor: pointer;
  }

  /* Grid (3 columns) */
  .fr-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
  @media (max-width: 1060px) { .fr-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 680px) { .fr-grid { grid-template-columns: 1fr; } }

  .fr-card {
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
  .fr-card:hover {
    transform: translateY(-3px);
    border-color: #f59e0b;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
  }

  .fr-card-header {
    margin-bottom: 12px;
  }
  .fr-review-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .fr-role-pill {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 11px;
    font-weight: 600;
  }
  .fr-feature-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .fr-tag-feature {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    font-size: 11.5px;
    font-weight: 700;
  }
  .fr-status-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
  }
  .fr-status-done { background: rgba(16, 185, 129, 0.12); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
  .fr-status-progress { background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
  .fr-status-planned { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
  .fr-status-review { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }

  .star-rating-display {
    display: inline-flex;
    align-items: center;
    gap: 2px;
  }
  .star-solid { fill: #f59e0b; color: #f59e0b; }
  .star-dim { color: var(--border2); }
  .rating-num-label { font-size: 12px; font-weight: 700; color: #f59e0b; margin-left: 5px; }

  .fr-card-title {
    margin: 0 0 8px;
    font-size: 15.5px;
    font-weight: 700;
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
    line-height: 1.35;
  }
  .fr-card-desc {
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

  .fr-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .fr-meta-user {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--text2);
  }
  .fr-dot { opacity: 0.5; }

  .fr-card-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fr-upvote-btn {
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
  .fr-upvote-btn:hover { color: #f59e0b; border-color: #f59e0b; }
  .fr-upvote-btn.upvoted {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }
  .fr-admin-pill {
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
  .fr-overlay {
    position: fixed;
    inset: 0;
    z-index: 100000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: flex-end;
    animation: frFadeIn 0.2s ease;
  }
  @keyframes frFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .fr-drawer {
    width: 100%;
    max-width: 560px;
    height: 100vh;
    background: var(--bg2, #0d1525);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5);
    animation: frSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes frSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }

  .fr-drawer-header {
    padding: 22px 26px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .fr-review-drawer-meta, .fr-feature-drawer-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }
  .fr-drawer-title {
    font-size: 20px;
    font-weight: 800;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
    margin: 0 0 6px;
  }
  .fr-drawer-sub {
    font-size: 12.5px;
    color: var(--text2);
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fr-drawer-close {
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
  .fr-drawer-close:hover { color: var(--text); border-color: var(--border2); }

  .fr-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px 26px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2) transparent;
  }
  .fr-drawer-body::-webkit-scrollbar { width: 6px; }
  .fr-drawer-body::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  .fr-admin-panel {
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.25);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .fr-admin-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #10b981;
    font-weight: 700;
    font-size: 13.5px;
  }
  .fr-admin-field label {
    display: block;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--text2);
    margin-bottom: 4px;
  }
  .fr-admin-field select {
    width: 100%;
    padding: 7px 10px;
    border-radius: 8px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 12.5px;
    outline: none;
  }
  .fr-btn-delete {
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
    width: fit-content;
  }
  .fr-btn-delete:hover { background: rgba(239, 68, 68, 0.1); }

  .fr-sec-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text);
    margin: 0 0 8px;
  }
  .fr-content-box, .fr-diag-box {
    padding: 12px 14px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--text);
  }
  .fr-content-box p { margin: 0; white-space: pre-wrap; }
  .fr-diag-box { font-size: 12px; color: var(--text2); }

  .fr-drawer-footer {
    padding: 16px 26px;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .fr-footer-votes {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .fr-footer-vote-btn {
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
  .fr-footer-vote-btn:hover {
    border-color: var(--border2);
    background: rgba(255, 255, 255, 0.04);
  }
  .fr-footer-vote-btn.upvoted {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }
  .fr-footer-vote-btn.downvoted {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }

  .fr-vote-btn {
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
  .fr-vote-btn:hover {
    border-color: var(--border2);
    color: var(--text);
  }
  .fr-upvote-btn.upvoted {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }
  .fr-downvote-btn.downvoted {
    background: rgba(239, 68, 68, 0.15);
    border-color: #ef4444;
    color: #ef4444;
  }

  .fr-comments-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #10b981;
    font-size: 11px;
    font-weight: 700;
  }

  /* Drawer Attachments */
  .fr-attachment-view {
    margin-top: 6px;
  }
  .fr-attachment-img {
    max-width: 100%;
    max-height: 240px;
    border-radius: 8px;
    border: 1px solid var(--border);
    object-fit: cover;
    transition: transform 0.2s;
  }
  .fr-attachment-img:hover {
    transform: scale(1.02);
  }
  .fr-attachment-file-btn {
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
  .fr-comments-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 12px;
  }
  .fr-comment-card {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px 14px;
  }
  .fr-comment-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .fr-comment-author {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--text);
  }
  .fr-staff-badge {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 4px;
    padding: 1px 5px;
    font-size: 9.5px;
    font-weight: 800;
    text-transform: uppercase;
  }
  .fr-comment-time {
    font-size: 11px;
    color: var(--text3);
  }
  .fr-comment-text {
    font-size: 13px;
    color: var(--text2);
    line-height: 1.5;
    margin: 0;
  }
  .fr-no-comments {
    font-size: 12.5px;
    color: var(--text3);
    margin: 4px 0 10px;
  }
  .fr-comment-form {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 10px;
  }
  .fr-comment-input {
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
  .fr-comment-input:focus {
    border-color: #10b981;
  }
  .fr-comment-submit-btn {
    align-self: flex-end;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 7px;
    background: #10b981;
    color: #070b14;
    border: none;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: filter 0.2s;
  }
  .fr-comment-submit-btn:hover {
    filter: brightness(1.1);
  }
  .fr-comment-submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* States */
  .fr-state-box {
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
  .fr-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--border);
    border-top-color: #f59e0b;
    border-radius: 50%;
    animation: frSpin 0.8s linear infinite;
    margin-bottom: 14px;
  }
  .empty-icon {
    display: block;
    margin: 0 auto 16px;
    opacity: 0.85;
  }
  .fr-state-box h3 {
    margin: 0 0 8px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
  }
  .fr-state-box p {
    margin: 0 0 20px;
    font-size: 14px;
    color: var(--text2);
    max-width: 480px;
  }
  .text-gold { color: #f59e0b; }
  .text-sky { color: #38bdf8; }
  .text-purple { color: #a855f7; }
  .text-emerald { color: #10b981; }
  @keyframes frSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
