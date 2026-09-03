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
} from "lucide-react";
import { submitBugReport } from "../services/bugService.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function SubmitFeedbackModal({
  isOpen,
  onClose,
  initialType = "feature", // 'feature' or 'review'
  onSuccess = null,
}) {
  const { user } = useAuth();

  const [type, setType] = useState(initialType);
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [userRole, setUserRole] = useState("Maker");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setType(initialType);
    if (user) {
      setReporterName(user.name || "");
      setReporterEmail(user.email || "");
      if (user.role === "teacher") setUserRole("Teacher");
      else if (user.role === "student") setUserRole("Student");
    }
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

  return (
    <div className="feedback-modal-backdrop" onClick={onClose}>
      <div className="feedback-modal-card" onClick={(e) => e.stopPropagation()}>
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

        {/* Toggle between Feature Request and Review */}
        <div className="feedback-type-toggle">
          <button
            type="button"
            className={`f-type-btn ${type === "feature" ? "f-type-btn-active feature-active" : ""}`}
            onClick={() => setType("feature")}
          >
            <Lightbulb size={15} />
            <span>Feature Request</span>
          </button>
          <button
            type="button"
            className={`f-type-btn ${type === "review" ? "f-type-btn-active review-active" : ""}`}
            onClick={() => setType("review")}
          >
            <Star size={15} />
            <span>User Review / Testimonial</span>
          </button>
        </div>

        {submitted ? (
          <div className="feedback-success-state">
            <CheckCircle2 size={46} className="text-emerald" />
            <h4>Thank You for Your Feedback!</h4>
            <p>Your contribution has been shared with the community and engineering team.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="feedback-modal-body">
            {errorMessage && <div className="feedback-error-banner">{errorMessage}</div>}

            {/* Star Rating Selector (If Review) */}
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
                          size={26}
                          className={filled ? "star-filled" : "star-empty"}
                        />
                      </button>
                    );
                  })}
                  <span className="rating-text-label">
                    {rating === 5 ? "Outstanding (5/5)" : rating === 4 ? "Very Good (4/5)" : rating === 3 ? "Good (3/5)" : "Needs Improvement"}
                  </span>
                </div>
              </div>
            )}

            {/* Role (If Review) */}
            {type === "review" && (
              <div className="feedback-field">
                <label className="feedback-label">I use OpenHW-Studio as a:</label>
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
            )}

            {/* Category (If Feature) */}
            {type === "feature" && (
              <div className="feedback-field">
                <label className="feedback-label">Category</label>
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

            {/* Title */}
            <div className="feedback-field">
              <label className="feedback-label">
                {type === "feature" ? "Feature Title" : "Review Summary"} <span className="req">*</span>
              </label>
              <input
                type="text"
                className="feedback-input"
                placeholder={type === "feature" ? "e.g. Add support for Raspberry Pi Pico W WiFi emulation" : "e.g. Fantastic tool for teaching embedded systems in schools"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="feedback-field">
              <label className="feedback-label">
                {type === "feature" ? "Detailed Idea & Use Case" : "Your Experience & Review"} <span className="req">*</span>
              </label>
              <textarea
                className="feedback-textarea"
                rows={4}
                placeholder={type === "feature" ? "Explain what this feature does, how you would use it, and what problem it solves..." : "Share what you enjoy most about the simulator, how it helps your projects, or any suggestions..."}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* User Info */}
            <div className="feedback-row">
              <div className="feedback-field flex-1">
                <label className="feedback-label">Your Name</label>
                <input
                  type="text"
                  className="feedback-input"
                  placeholder="Anonymous or your name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                />
              </div>
              <div className="feedback-field flex-1">
                <label className="feedback-label">
                  Email
                  <span className="field-hint">(Optional)</span>
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

            <div className="feedback-modal-footer">
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
    max-width: 560px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 24px 54px rgba(0, 0, 0, 0.5);
    animation: fSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes fSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .feedback-modal-header {
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .feedback-modal-title {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .feedback-modal-sub {
    margin: 0;
    font-size: 12.5px;
    color: var(--text2);
  }
  .feedback-close-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text2);
    cursor: pointer;
    transition: all 0.2s;
  }
  .feedback-close-btn:hover { color: var(--text); border-color: var(--border2); }

  .feedback-type-toggle {
    display: flex;
    padding: 14px 24px 0;
    gap: 10px;
  }
  .f-type-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 9px 14px;
    border-radius: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    color: var(--text2);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .f-type-btn:hover { color: var(--text); border-color: var(--border2); }
  .feature-active {
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.35);
    color: #38bdf8;
  }
  .review-active {
    background: rgba(245, 158, 11, 0.12);
    border-color: rgba(245, 158, 11, 0.35);
    color: #f59e0b;
  }

  .feedback-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px 22px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2) transparent;
  }
  .feedback-modal-body::-webkit-scrollbar { width: 6px; }
  .feedback-modal-body::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 99px; }

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

  .feedback-modal-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .f-modal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 9px;
    font-size: 13px;
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
