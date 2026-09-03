import React, { useState, useEffect } from "react";
import {
  X,
  Star,
  Lightbulb,
  MessageSquare,
  CheckCircle2,
  Send,
  Loader2,
  User,
  Layers,
  LogIn,
  ShieldCheck,
  Github,
  ExternalLink,
  Paperclip,
  Image,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { submitBugReport } from "../services/bugService.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function SubmitFeedbackModal({
  isOpen,
  onClose,
  initialType = "feature", // 'feature' or 'review'
  onSuccess = null,
}) {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [type, setType] = useState(initialType);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userRole, setUserRole] = useState("Maker");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMessage("Attachment exceeds 2.5 MB. Please upload a smaller image or paste an external image link.");
      return;
    }

    setAttachmentName(file.name);
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      setAttachmentUrl(loadEvt.target.result);
      setErrorMessage("");
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    setType(initialType);
    if (user) {
      setReporterName(user.name || "");
      setReporterEmail(user.email || "");
      if (user.role === "teacher") setUserRole("Teacher");
      else if (user.role === "student") setUserRole("Student");
    }
    setAttachmentUrl("");
    setAttachmentName("");
    setSubmitted(false);
    setErrorMessage("");
  }, [initialType, user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage("Please fill in both the title and details.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        rating: type === "review" ? rating : 5,
        userRole: type === "review" ? userRole : "Maker",
        category,
        attachmentUrl: attachmentUrl || "",
        reporterName: reporterName.trim() || (user ? user.name : "Community Member"),
        reporterEmail: reporterEmail.trim() || (user ? user.email : ""),
      };

      await submitBugReport(payload);
      setSubmitted(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 1600);
    } catch (err) {
      console.error("Submission error:", err);
      setErrorMessage(
        err?.response?.data?.error || "Failed to submit. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Build GitHub fallback URL for developers with feature proposal fields pre-populated
  const getGitHubFallbackUrl = () => {
    const isComponent = category === "component";
    const repo = isComponent
      ? "https://github.com/OpenHW-Studio/openhw-studio-emulator"
      : "https://github.com/OpenHW-Studio/OpenHW-studio-frontend";

    const issueTitle = encodeURIComponent(
      title.trim() || `[FEATURE] ${category === "component" ? "New Board / Microcontroller Proposal" : "Simulator Feature Proposal"}`
    );

    let markdownBody = "";
    if (description.trim()) {
      markdownBody += `### Proposal & Use Case\n${description.trim()}\n\n`;
    }
    markdownBody += `### Target Category\n- **Category:** \`${category}\`\n- **Target Audience:** ${userRole}\n\n`;
    if (attachmentUrl) {
      markdownBody += `### Attached Reference\n`;
      markdownBody += attachmentUrl.startsWith("data:")
        ? `*Circuit / Feature attachment included with submission (${attachmentName || "attached image"})*\n\n`
        : `![Attachment](${attachmentUrl})\n\n`;
    }
    markdownBody += `### Submitter Info\n`;
    markdownBody += `- **Proposed By:** ${reporterName.trim() || (user ? user.name : "Community Member")}\n`;
    if (reporterEmail.trim() || user?.email) {
      markdownBody += `- **Contact Email:** ${reporterEmail.trim() || user.email}\n`;
    }
    markdownBody += `- **Source:** OpenHW-Studio Web Simulator\n`;

    const issueBody = encodeURIComponent(markdownBody);
    return `${repo}/issues/new?title=${issueTitle}&body=${issueBody}&labels=enhancement`;
  };

  return (
    <div className="feedback-modal-backdrop" onClick={onClose}>
      <div className="feedback-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
        <div className="feedback-modal-header">
          <div className="feedback-header-title-wrap">
            <h3 className="feedback-modal-title">
              {type === "feature" ? "Request a Feature or Board" : "Share a Review & Rating"}
            </h3>
            <p className="feedback-modal-sub">
              Your voice guides what we build next for OpenHW-Studio.
            </p>
          </div>
          <button className="feedback-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="feedback-success-state">
            <CheckCircle2 size={46} className="text-emerald" />
            <h4>Thank You for Your Feedback!</h4>
            <p>Your contribution has been shared with the community and engineering team.</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="feedback-auth-required">
            <div className="f-auth-icon-wrap">
              <ShieldCheck size={36} className="text-sky" />
            </div>
            <h4>Sign-in Required</h4>
            <p>
              To maintain high credibility and prevent bot spam, you must be signed in to
              submit a {type === "review" ? "verified platform review" : "community feature request"}.
            </p>
            <div className="f-auth-actions">
              <button
                type="button"
                className="f-modal-btn f-modal-btn-primary"
                onClick={() => {
                  onClose();
                  navigate("/login");
                }}
              >
                <LogIn size={15} />
                <span>Log In to Continue</span>
              </button>
              <button
                type="button"
                className="f-modal-btn f-modal-btn-secondary"
                onClick={() => {
                  onClose();
                  navigate("/signup");
                }}
              >
                <span>Create an Account</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-modal-form">
            {errorMessage && <div className="feedback-error-banner">{errorMessage}</div>}

            <div className="feedback-studio-grid">
              {/* ── COLUMN 1: Meta & Identity (~290px) ─────────────────────── */}
              <div className="feedback-col-meta">
                {/* Vertical Stacked Type Switcher */}
                <div className="feedback-field">
                  <label className="feedback-label">Feedback Type</label>
                  <div className="feedback-type-vertical">
                    <button
                      type="button"
                      className={`f-type-v-btn ${type === "feature" ? "f-type-v-active v-feature" : ""}`}
                      onClick={() => setType("feature")}
                    >
                      <Lightbulb size={16} />
                      <div className="f-type-v-text">
                        <span className="f-type-v-title">Feature Request</span>
                        <span className="f-type-v-desc">Propose new board, sensor, or enhancement</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`f-type-v-btn ${type === "review" ? "f-type-v-active v-review" : ""}`}
                      onClick={() => setType("review")}
                    >
                      <Star size={16} />
                      <div className="f-type-v-text">
                        <span className="f-type-v-title">User Review & Rating</span>
                        <span className="f-type-v-desc">Share feedback & star rating for community</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Rating (If Review) */}
                {type === "review" && (
                  <div className="feedback-field rating-field">
                    <label className="feedback-label">Your Rating</label>
                    <div className="stars-row">
                      {[1, 2, 3, 4, 5].map((s) => {
                        const filled = (hoverRating || rating) >= s;
                        return (
                          <button
                            key={s}
                            type="button"
                            className="star-btn"
                            onMouseEnter={() => setHoverRating(s)}
                            onMouseLeave={() => setHoverRating(0)}
                            onClick={() => setRating(s)}
                          >
                            <Star
                              size={24}
                              className={filled ? "star-filled" : "star-empty"}
                            />
                          </button>
                        );
                      })}
                      <span className="rating-text-label">
                        {rating === 5 ? "5 / 5" : rating === 4 ? "4 / 5" : rating === 3 ? "3 / 5" : `${rating} / 5`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Role / Audience */}
                <div className="feedback-field">
                  <label className="feedback-label">
                    {type === "review" ? "I use OpenHW-Studio as a:" : "Target Audience / Use Case:"}
                  </label>
                  <select
                    className="feedback-select"
                    value={userRole}
                    onChange={(e) => setUserRole(e.target.value)}
                  >
                    <option value="Student">Student / Learner</option>
                    <option value="Teacher">Teacher / Educator</option>
                    <option value="Professor">College Professor / Researcher</option>
                    <option value="Maker">Hardware Maker / Hobbyist</option>
                    <option value="Engineer">Firmware / Embedded Engineer</option>
                  </select>
                </div>

                {/* Title / Summary */}
                <div className="feedback-field">
                  <label className="feedback-label">
                    {type === "feature" ? "Feature Title" : "Review Summary"} <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="feedback-input"
                    placeholder={type === "feature" ? "e.g. Add Raspberry Pi Pico W" : "e.g. Excellent for embedded labs"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Submitter Name */}
                <div className="feedback-field">
                  <label className="feedback-label">Your Name</label>
                  <input
                    type="text"
                    className="feedback-input"
                    placeholder="Your Name"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                  />
                </div>

                {/* Submitter Email */}
                <div className="feedback-field">
                  <label className="feedback-label">
                    Email <span className="field-hint">(Private)</span>
                  </label>
                  <input
                    type="email"
                    className="feedback-input"
                    placeholder="name@example.com"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                  />
                </div>
              </div>

              {/* ── COLUMN 2: Content & Details (Expanded) ─────────────────── */}
              <div className="feedback-col-content">
                {/* Category Selector (If Feature) */}
                {type === "feature" && (
                  <div className="feedback-field">
                    <label className="feedback-label">Hardware Category</label>
                    <select
                      className="feedback-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="component">New Microcontroller or Board (e.g. STM32, ESP32-S3)</option>
                      <option value="general">New Sensor, Display, or Actuator</option>
                      <option value="simulator_ui">Simulator Canvas & Wire Routing</option>
                      <option value="compiler_backend">Code Editor, Libraries, & Autocomplete</option>
                    </select>
                  </div>
                )}

                {/* Description / Review Details */}
                <div className="feedback-field flex-grow-field">
                  <label className="feedback-label">
                    {type === "feature" ? "Detailed Idea & Hardware Use Case" : "Your Experience & Review Details"} <span className="req">*</span>
                  </label>
                  <textarea
                    className="feedback-textarea feedback-main-textarea"
                    rows={8}
                    placeholder={type === "feature" ? "Explain what this feature does, how you would use it, and what problem it solves in your projects..." : "Share what you enjoy most about the simulator, how it helps your coursework or projects, and any suggestions for improvements..."}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {/* Screenshot / File Attachment */}
                <div className="feedback-field">
                  <label className="feedback-label">
                    <Paperclip size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Attachment or Screenshot <span className="field-hint">(Optional &bull; PNG, JPG, or PDF up to 2.5 MB)</span>
                  </label>
                  <div className="attachment-upload-zone">
                    <input
                      type="file"
                      id="feedback-attachment-input"
                      className="attachment-file-input"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="feedback-attachment-input" className="attachment-upload-label">
                      <Image size={18} className="attachment-icon" />
                      {attachmentName ? (
                        <div className="attachment-file-info">
                          <span className="attachment-filename">{attachmentName}</span>
                          <button
                            type="button"
                            className="attachment-clear-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              setAttachmentUrl("");
                              setAttachmentName("");
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="attachment-placeholder-text">
                          <strong>Click to upload</strong> or drag and drop reference screenshot or spec
                        </div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Helpful Community Notice */}
                <div className="feedback-notice-box">
                  <p>
                    {type === "feature"
                      ? "💡 Community feature proposals are reviewed regularly by our engineering team and prioritized based on community votes."
                      : "⭐ Verified community reviews help students, professors, and open-source contributors discover OpenHW-Studio."}
                  </p>
                </div>
              </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
            <div className="feedback-modal-footer">
              {type === "feature" && (
                <div className="github-alt-link">
                  <a
                    href={getGitHubFallbackUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Github size={13} />
                    <span>Developer with GitHub? Submit proposal on GitHub</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}

              <div className="f-footer-actions">
                <button
                  type="button"
                  className="f-modal-btn f-modal-btn-secondary"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="f-modal-btn f-modal-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 size={14} className="spin-icon" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Submit {type === "feature" ? "Feature Request" : "Review"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <style>{SUBMIT_FEEDBACK_MODAL_CSS}</style>
    </div>
  );
}

const SUBMIT_FEEDBACK_MODAL_CSS = `
  .feedback-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100010;
    background: rgba(5, 8, 17, 0.75);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: fFadeIn 0.2s ease;
  }
  @keyframes fFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .feedback-modal-card {
    background: var(--bg2, #0d1525);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%;
    max-width: 1020px;
    height: 88vh;
    max-height: 820px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.6);
    animation: fSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes fSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .feedback-modal-header {
    padding: 11px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }
  .feedback-modal-title {
    margin: 0 0 2px;
    font-size: 16.5px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .feedback-modal-sub {
    margin: 0;
    font-size: 12px;
    color: var(--text2);
  }
  .feedback-close-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 7px;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    cursor: pointer;
    transition: all 0.2s;
  }
  .feedback-close-btn:hover { color: var(--text); border-color: var(--border2); }

  .feedback-modal-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Studio 2-Column Grid Layout ──────────────────────────────────── */
  .feedback-studio-grid {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  @media (max-width: 768px) {
    .feedback-studio-grid {
      flex-direction: column;
      overflow-y: auto;
    }
  }

  /* Left Column: Meta & Identity (~300px) */
  .feedback-col-meta {
    width: 300px;
    flex-shrink: 0;
    padding: 20px 24px;
    border-right: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.18);
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  @media (max-width: 768px) {
    .feedback-col-meta {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
  }

  /* Right Column: Proposal / Review Core (Expanded) */
  .feedback-col-content {
    flex: 1;
    min-width: 0;
    padding: 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border2) transparent;
  }
  .feedback-col-content::-webkit-scrollbar { width: 6px; }
  .feedback-col-content::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

  /* ── Vertical Type Switcher in Column 1 ────────────────────────────── */
  .feedback-type-vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .f-type-v-btn {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text2);
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }
  .f-type-v-btn:hover {
    color: var(--text);
    border-color: var(--border2);
  }
  .f-type-v-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .f-type-v-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text);
  }
  .f-type-v-desc {
    font-size: 11px;
    color: var(--text2);
    line-height: 1.3;
  }
  .f-type-v-active.v-feature {
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.4);
    color: #38bdf8;
  }
  .f-type-v-active.v-feature .f-type-v-title {
    color: #38bdf8;
  }
  .f-type-v-active.v-review {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.4);
    color: #f59e0b;
  }
  .f-type-v-active.v-review .f-type-v-title {
    color: #f59e0b;
  }

  .feedback-notice-box {
    padding: 12px 14px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.05);
    border: 1px solid rgba(56, 189, 248, 0.18);
    margin-top: auto;
  }
  .feedback-notice-box p {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--text2);
  }

  .feedback-main-textarea {
    min-height: 160px;
    resize: vertical;
  }

  .feedback-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .feedback-row { display: flex; gap: 12px; }
  .flex-1 { flex: 1; }

  .feedback-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
  }
  .req { color: #ef4444; margin-left: 2px; }
  .field-hint { font-size: 11.5px; color: var(--text2); margin-left: 6px; font-weight: 400; }

  .feedback-input, .feedback-textarea, .feedback-select {
    width: 100%;
    padding: 9px 13px;
    border-radius: 9px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text);
    font-size: 13.5px;
    outline: none;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  .feedback-input:focus, .feedback-textarea:focus, .feedback-select:focus {
    border-color: var(--accent, #38bdf8);
  }

  /* Stars Selector */
  .stars-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 0;
  }
  .star-btn {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 2px;
    transition: transform 0.15s ease;
  }
  .star-btn:hover { transform: scale(1.2); }
  .star-filled {
    fill: #f59e0b;
    color: #f59e0b;
  }
  .star-empty {
    color: var(--border2);
  }
  .rating-text-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text2);
    margin-left: 8px;
  }

  /* ── Attachment Upload Box ─────────────────────────────────────────── */
  .attachment-upload-zone {
    position: relative;
    border: 1.5px dashed var(--border);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.02);
    transition: all 0.2s ease;
  }
  .attachment-upload-zone:hover {
    border-color: var(--accent, #38bdf8);
    background: rgba(56, 189, 248, 0.04);
  }
  .attachment-file-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
    z-index: 2;
  }
  .attachment-upload-label {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    cursor: pointer;
    color: var(--text2);
    font-size: 13px;
  }
  .attachment-icon {
    color: var(--accent, #38bdf8);
    flex-shrink: 0;
  }
  .attachment-placeholder-text {
    flex: 1;
  }
  .attachment-placeholder-text strong {
    color: var(--text);
  }
  .attachment-file-info {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }
  .attachment-filename {
    font-weight: 600;
    color: var(--text);
    font-size: 12.5px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }
  .attachment-clear-btn {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    font-weight: 600;
    position: relative;
    z-index: 3;
  }
  .attachment-clear-btn:hover {
    background: rgba(239, 68, 68, 0.25);
  }

  .feedback-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 24px;
    border-top: 1px solid var(--border);
    background: rgba(10, 16, 28, 0.9);
    flex-shrink: 0;
  }
  .f-footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  .github-alt-link a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: var(--text2);
    text-decoration: none;
    transition: color 0.2s;
  }
  .github-alt-link a:hover {
    color: var(--accent, #38bdf8);
  }
  .f-modal-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 14px;
    border-radius: 7px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .f-modal-btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text2);
  }
  .f-modal-btn-secondary:hover { color: var(--text); border-color: var(--border2); }
  .f-modal-btn-primary {
    background: var(--accent, #38bdf8);
    color: #070b14;
    border: none;
  }
  .f-modal-btn-primary:hover { filter: brightness(1.1); }
  .f-modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .feedback-auth-required {
    padding: 36px 28px 44px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .f-auth-icon-wrap {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
  }
  .feedback-auth-required h4 {
    margin: 0 0 10px;
    font-size: 20px;
    font-weight: 700;
    color: var(--text);
    font-family: 'Space Grotesk', sans-serif;
  }
  .feedback-auth-required p {
    margin: 0 auto 26px;
    max-width: 420px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--text2);
  }
  .f-auth-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .text-sky { color: #38bdf8; }

  .feedback-success-state {
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .feedback-success-state h4 { margin: 12px 0 6px; font-size: 18px; color: var(--text); }
  .feedback-success-state p { margin: 0; font-size: 13.5px; color: var(--text2); }

  .feedback-error-banner {
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 12.5px;
  }
  .text-emerald { color: #10b981; }
  .spin-icon { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
