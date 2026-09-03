import React, { useState, useEffect } from "react";
import {
  X,
  Bug,
  Lightbulb,
  CheckCircle2,
  Cpu,
  Code,
  Github,
  Send,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { submitBugReport } from "../services/bugService.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function ReportBugModal({
  isOpen,
  onClose,
  initialComponent = null,
  onSuccess = null,
}) {
  const { user } = useAuth();

  const [type, setType] = useState("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [componentType, setComponentType] = useState("");
  const [componentLabel, setComponentLabel] = useState("");
  const [selectedFeatures, setSelectedFeatures] = useState([]);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Populate from initialComponent if provided
  useEffect(() => {
    if (initialComponent) {
      setCategory("component");
      setComponentType(initialComponent.type || "");
      setComponentLabel(initialComponent.title || initialComponent.label || "");
      setTitle(`[Issue] ${initialComponent.title || initialComponent.label}`);
    } else {
      setCategory("general");
      setComponentType("");
      setComponentLabel("");
      setTitle("");
    }
    if (user) {
      setReporterName(user.name || "");
      setReporterEmail(user.email || "");
    }
    setSelectedFeatures([]);
    setSubmitted(false);
    setErrorMessage("");
  }, [initialComponent, user, isOpen]);

  if (!isOpen) return null;

  const handleFeatureToggle = (feature) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMessage("Please provide a title and detailed description.");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");

    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        type,
        category: componentType ? "component" : category,
        componentType,
        componentLabel,
        failingFeatures: selectedFeatures,
        codeSnippet,
        stepsToReproduce,
        browserInfo: typeof navigator !== "undefined" ? navigator.userAgent : "",
        osInfo: typeof navigator !== "undefined" ? navigator.platform : "",
        reporterName: reporterName.trim() || (user ? user.name : "Anonymous"),
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
      console.error("Submission failed:", err);
      setErrorMessage(
        err?.response?.data?.error || "Failed to submit feedback. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Build GitHub fallback URL for developers
  const getGitHubFallbackUrl = () => {
    const isComponent = Boolean(componentType);
    const repo = isComponent
      ? "https://github.com/OpenHW-Studio/openhw-studio-emulator"
      : "https://github.com/OpenHW-Studio/OpenHW-studio-frontend";

    const issueTitle = encodeURIComponent(title || `[${type.toUpperCase()}] New Report`);
    const issueBody = encodeURIComponent(`### Description\n${description}\n\n### Component\n${componentLabel || componentType || 'General'}\n\n### Environment\n${typeof navigator !== 'undefined' ? navigator.userAgent : ''}`);
    return `${repo}/issues/new?title=${issueTitle}&body=${issueBody}`;
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div className="report-header-title-wrap">
            <h3 className="report-modal-title">
              {type === "bug" ? "Report a Bug / Issue" : "Submit Feature Request"}
            </h3>
            <p className="report-modal-sub">
              Your feedback is saved directly into OpenHW-Studio without needing a GitHub account.
            </p>
          </div>
          <button className="report-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Type Toggle: Bug vs Feature */}
        <div className="report-type-toggle">
          <button
            type="button"
            className={`type-btn ${type === "bug" ? "type-btn-active type-btn-bug" : ""}`}
            onClick={() => setType("bug")}
          >
            <Bug size={15} />
            <span>Bug Report</span>
          </button>
          <button
            type="button"
            className={`type-btn ${type === "feature" ? "type-btn-active type-btn-feature" : ""}`}
            onClick={() => setType("feature")}
          >
            <Lightbulb size={15} />
            <span>Feature Request</span>
          </button>
        </div>

        {submitted ? (
          <div className="report-success-state">
            <CheckCircle2 size={46} className="success-icon" />
            <h4>Feedback Submitted Successfully!</h4>
            <p>Our engineering team has received your report. Thank you for helping improve OpenHW-Studio!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal-body">
            {errorMessage && <div className="report-error-banner">{errorMessage}</div>}

            {/* Context Badge if from component */}
            {componentLabel && (
              <div className="report-component-context">
                <Cpu size={14} />
                <span>
                  Attached Component: <strong>{componentLabel}</strong> (<code>{componentType}</code>)
                </span>
              </div>
            )}

            {/* Title */}
            <div className="report-field">
              <label className="report-label">
                Title <span className="req">*</span>
              </label>
              <input
                type="text"
                className="report-input"
                placeholder={type === "bug" ? "e.g. Servo motor jittering when using PWM pin 9" : "e.g. Add support for I2C OLED display driver"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            {/* Component Feature Checkboxes (if features available) */}
            {initialComponent && (initialComponent.working?.length > 0 || initialComponent.inProgress?.length > 0) && (
              <div className="report-field">
                <label className="report-label">
                  Failing or Misbehaving Features
                  <span className="field-hint">(Select any that failed during your simulation)</span>
                </label>
                <div className="features-checklist-box">
                  {[...(initialComponent.working || []), ...(initialComponent.inProgress || [])].map((f, i) => (
                    <label key={i} className="feature-check-label">
                      <input
                        type="checkbox"
                        checked={selectedFeatures.includes(f)}
                        onChange={() => handleFeatureToggle(f)}
                      />
                      <span>{f}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            <div className="report-field">
              <label className="report-label">
                Description <span className="req">*</span>
              </label>
              <textarea
                className="report-textarea"
                rows={3}
                placeholder={type === "bug" ? "Describe clearly what happened versus what you expected to happen..." : "Describe the feature and how it would help your hardware projects..."}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            {/* Steps to reproduce (only for bugs) */}
            {type === "bug" && (
              <div className="report-field">
                <label className="report-label">
                  Steps to Reproduce
                  <span className="field-hint">(Optional)</span>
                </label>
                <textarea
                  className="report-textarea"
                  rows={2}
                  placeholder="1. Connected Pin 9 to Servo&#10;2. Ran Arduino sweep sketch&#10;3. Noticed motor does not rotate..."
                  value={stepsToReproduce}
                  onChange={(e) => setStepsToReproduce(e.target.value)}
                />
              </div>
            )}

            {/* Code Snippet */}
            <div className="report-field">
              <label className="report-label">
                <Code size={13} style={{ display: 'inline', marginRight: 4 }} />
                Arduino / C++ Code Snippet
                <span className="field-hint">(Optional)</span>
              </label>
              <textarea
                className="report-textarea report-code-textarea"
                rows={3}
                placeholder="// Paste minimal Arduino / MicroPython sketch here..."
                value={codeSnippet}
                onChange={(e) => setCodeSnippet(e.target.value)}
              />
            </div>

            {/* Reporter Contact Info */}
            <div className="report-row">
              <div className="report-field flex-1">
                <label className="report-label">Your Name</label>
                <input
                  type="text"
                  className="report-input"
                  placeholder="Anonymous or your name"
                  value={reporterName}
                  onChange={(e) => setReporterName(e.target.value)}
                />
              </div>
              <div className="report-field flex-1">
                <label className="report-label">
                  Email
                  <span className="field-hint">(Optional, for notification when fixed)</span>
                </label>
                <input
                  type="email"
                  className="report-input"
                  placeholder="name@example.com"
                  value={reporterEmail}
                  onChange={(e) => setReporterEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="report-modal-footer">
              <div className="github-alt-link">
                <a
                  href={getGitHubFallbackUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Github size={13} />
                  <span>Developer with GitHub? Submit on GitHub instead</span>
                  <ExternalLink size={12} />
                </a>
              </div>

              <div className="footer-actions">
                <button
                  type="button"
                  className="modal-btn modal-btn-secondary"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn modal-btn-primary"
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
                      <span>Submit {type === "bug" ? "Bug Report" : "Feature"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      <style>{REPORT_MODAL_CSS}</style>
    </div>
  );
}

const REPORT_MODAL_CSS = `
  .report-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100010;
    background: rgba(5, 8, 17, 0.7);
    backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: modalFadeIn 0.2s ease;
  }
  @keyframes modalFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .report-modal-card {
    background: var(--bg2, #0d1525);
    border: 1px solid var(--border);
    border-radius: 16px;
    width: 100%;
    max-width: 580px;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes modalSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .report-modal-header {
    padding: 18px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }
  .report-modal-title {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .report-modal-sub {
    margin: 0;
    font-size: 12.5px;
    color: var(--text2);
  }
  .report-close-btn {
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
  .report-close-btn:hover {
    color: var(--text);
    border-color: var(--border2);
  }

  .report-type-toggle {
    display: flex;
    padding: 12px 24px 0;
    gap: 10px;
  }
  .type-btn {
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
  .type-btn:hover {
    color: var(--text);
    border-color: var(--border2);
  }
  .type-btn-active.type-btn-bug {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.35);
    color: #ef4444;
  }
  .type-btn-active.type-btn-feature {
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.35);
    color: #38bdf8;
  }

  .report-modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    scrollbar-width: thin;
    scrollbar-color: var(--border2) transparent;
  }
  .report-modal-body::-webkit-scrollbar {
    width: 6px;
  }
  .report-modal-body::-webkit-scrollbar-thumb {
    background: var(--border2);
    border-radius: 99px;
  }

  .report-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .report-row {
    display: flex;
    gap: 12px;
  }
  .flex-1 { flex: 1; }

  .report-label {
    font-size: 12.5px;
    font-weight: 600;
    color: var(--text);
  }
  .req { color: #ef4444; margin-left: 2px; }
  .field-hint {
    font-size: 11.5px;
    color: var(--text2);
    font-weight: 400;
    margin-left: 6px;
  }

  .report-input, .report-textarea {
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
  .report-input:focus, .report-textarea:focus {
    border-color: var(--accent, #38bdf8);
  }
  .report-code-textarea {
    font-family: monospace;
    font-size: 12.5px;
    background: rgba(0, 0, 0, 0.25);
  }

  .report-component-context {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.2);
    color: var(--accent, #38bdf8);
    font-size: 12px;
  }
  .report-component-context code {
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 5px;
    border-radius: 4px;
  }

  .features-checklist-box {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 120px;
    overflow-y: auto;
    padding: 8px 12px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
  }
  .feature-check-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    color: var(--text2);
    cursor: pointer;
  }
  .feature-check-label:hover { color: var(--text); }
  .feature-check-label input { cursor: pointer; }

  .report-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding-top: 10px;
    border-top: 1px solid var(--border);
    flex-wrap: wrap;
  }
  .github-alt-link a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--text2);
    text-decoration: none;
    transition: color 0.2s;
  }
  .github-alt-link a:hover {
    color: var(--accent, #38bdf8);
  }
  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .modal-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }
  .modal-btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text2);
  }
  .modal-btn-secondary:hover { color: var(--text); border-color: var(--border2); }
  .modal-btn-primary {
    background: var(--accent, #38bdf8);
    color: #070b14;
    border: none;
  }
  .modal-btn-primary:hover { filter: brightness(1.1); }
  .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .report-success-state {
    padding: 48px 24px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .success-icon { color: #10b981; margin-bottom: 12px; }
  .report-success-state h4 { margin: 0 0 6px; font-size: 18px; color: var(--text); }
  .report-success-state p { margin: 0; font-size: 13.5px; color: var(--text2); max-width: 400px; }

  .report-error-banner {
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(239, 68, 68, 0.12);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    font-size: 12.5px;
  }
  .spin-icon { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
`;
