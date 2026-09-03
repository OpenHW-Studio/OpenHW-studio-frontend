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
  Paperclip,
  Image,
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
        attachmentUrl,
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

  // Build GitHub fallback URL for developers with all filled fields pre-populated
  const getGitHubFallbackUrl = () => {
    const isComponent = Boolean(componentType);
    const repo = isComponent
      ? "https://github.com/OpenHW-Studio/openhw-studio-emulator"
      : "https://github.com/OpenHW-Studio/OpenHW-studio-frontend";

    const issueTitle = encodeURIComponent(
      title.trim() || `[${type === "bug" ? "BUG" : "FEATURE"}] ${componentLabel || "Simulation Feedback"}`
    );

    let markdownBody = "";

    // 1. Description
    if (description.trim()) {
      markdownBody += `### Description\n${description.trim()}\n\n`;
    }

    // 2. Component details
    if (componentLabel || componentType) {
      markdownBody += `### Component Context\n- **Label:** ${componentLabel || "N/A"}\n- **Type / ID:** \`${componentType || "N/A"}\`\n\n`;
    }

    // 3. Failing features
    if (selectedFeatures.length > 0) {
      markdownBody += `### Failing or Affected Features\n${selectedFeatures.map((f) => `- [x] ${f}`).join("\n")}\n\n`;
    }

    // 4. Steps to reproduce
    if (stepsToReproduce.trim()) {
      markdownBody += `### Steps to Reproduce\n${stepsToReproduce.trim()}\n\n`;
    }

    // 5. Code snippet
    if (codeSnippet.trim()) {
      markdownBody += `### Code Snippet (Arduino / C++ / MicroPython)\n\`\`\`cpp\n${codeSnippet.trim()}\n\`\`\`\n\n`;
    }

    // 6. Attachment note (if uploaded in browser)
    if (attachmentName) {
      markdownBody += `### Attached Screenshot / Media\n- File attached in form: **${attachmentName}**\n*(Tip: You can also directly drag & drop the image file into this GitHub issue box)*\n\n`;
    }

    // 7. Submitter & Environment
    markdownBody += `### Submitter & Environment Info\n`;
    markdownBody += `- **Reported By:** ${reporterName.trim() || "Community Member"}\n`;
    if (reporterEmail.trim()) {
      markdownBody += `- **Contact Email:** ${reporterEmail.trim()}\n`;
    }
    if (typeof navigator !== "undefined") {
      markdownBody += `- **Browser:** \`${navigator.userAgent}\`\n`;
      markdownBody += `- **Platform / OS:** \`${navigator.platform || "Unknown"}\`\n`;
    }
    markdownBody += `- **Source:** OpenHW-Studio Web Simulator Form\n`;

    const issueBody = encodeURIComponent(markdownBody);
    return `${repo}/issues/new?title=${issueTitle}&body=${issueBody}`;
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* ── HEADER ────────────────────────────────────────────────────────── */}
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

        {submitted ? (
          <div className="report-success-state">
            <CheckCircle2 size={46} className="success-icon" />
            <h4>Feedback Submitted Successfully!</h4>
            <p>Our engineering team has received your report. Thank you for helping improve OpenHW-Studio!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="report-modal-form">
            {errorMessage && <div className="report-error-banner">{errorMessage}</div>}

            <div className="report-studio-grid">
              {/* ── COLUMN 1: Meta & Identity (~290px) ─────────────────────── */}
              <div className="report-col-meta">
                {/* Vertical Stacked Type Switcher */}
                <div className="report-field">
                  <label className="report-label">Submission Type</label>
                  <div className="report-type-vertical">
                    <button
                      type="button"
                      className={`type-v-btn ${type === "bug" ? "type-v-btn-active v-bug" : ""}`}
                      onClick={() => setType("bug")}
                    >
                      <Bug size={16} />
                      <div className="type-v-text">
                        <span className="type-v-title">Bug Report</span>
                        <span className="type-v-desc">Glitch, broken pin, or unexpected behavior</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      className={`type-v-btn ${type === "feature" ? "type-v-btn-active v-feature" : ""}`}
                      onClick={() => setType("feature")}
                    >
                      <Lightbulb size={16} />
                      <div className="type-v-text">
                        <span className="type-v-title">Feature Request</span>
                        <span className="type-v-desc">New hardware board, sensor, or enhancement</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="report-field">
                  <label className="report-label">
                    {type === "bug" ? "Issue Title" : "Feature Title"} <span className="req">*</span>
                  </label>
                  <input
                    type="text"
                    className="report-input"
                    placeholder={type === "bug" ? "e.g. Servo jitter on PWM pin 9" : "e.g. Support Raspberry Pi Pico W WiFi"}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                {/* Reporter Name */}
                <div className="report-field">
                  <label className="report-label">Your Name</label>
                  <input
                    type="text"
                    className="report-input"
                    placeholder="Anonymous or your name"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                  />
                </div>

                {/* Reporter Email */}
                <div className="report-field">
                  <label className="report-label">
                    Email <span className="field-hint">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    className="report-input"
                    placeholder="name@example.com"
                    value={reporterEmail}
                    onChange={(e) => setReporterEmail(e.target.value)}
                  />
                </div>

                {/* Tip Box */}
                <div className="report-guide-box">
                  <strong>Tip:</strong> Including a minimal Arduino sketch or reproduction steps helps our maintainers diagnose and release fixes much faster.
                </div>
              </div>

              {/* ── COLUMN 2: Content & Technical Details (Expanded) ────────── */}
              <div className="report-col-content">
                {/* Context Badge if attached to a component */}
                {componentLabel && (
                  <div className="report-component-context">
                    <Cpu size={14} />
                    <span>
                      Attached Component: <strong>{componentLabel}</strong> (<code>{componentType}</code>)
                    </span>
                  </div>
                )}

                {/* Component Feature Checkboxes (Bug Specific) */}
                {initialComponent && (initialComponent.working?.length > 0 || initialComponent.inProgress?.length > 0) && (
                  <div className="report-field">
                    <label className="report-label">
                      Failing or Misbehaving Features
                      <span className="field-hint">(Select any that failed during simulation)</span>
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
                    {type === "bug" ? "Detailed Description" : "Proposal Details & Use Case"} <span className="req">*</span>
                  </label>
                  <textarea
                    className="report-textarea"
                    rows={4}
                    placeholder={type === "bug" ? "Describe clearly what happened versus what you expected to happen..." : "Describe the feature, why it is needed, and how it would improve simulation projects..."}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {/* Steps to Reproduce */}
                {type === "bug" ? (
                  <div className="report-field">
                    <label className="report-label">
                      Steps to Reproduce <span className="field-hint">(Optional)</span>
                    </label>
                    <textarea
                      className="report-textarea"
                      rows={3}
                      placeholder="1. Connected Pin 9 to Servo&#10;2. Ran Arduino sweep sketch&#10;3. Noticed motor does not rotate..."
                      value={stepsToReproduce}
                      onChange={(e) => setStepsToReproduce(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="report-field">
                    <label className="report-label">
                      Target Board / Hardware Ecosystem <span className="field-hint">(Optional)</span>
                    </label>
                    <textarea
                      className="report-textarea"
                      rows={3}
                      placeholder="e.g. Raspberry Pi Pico, ESP32-S3, Arduino UNO R4 WiFi, MicroPython, or specific sensor models..."
                      value={stepsToReproduce}
                      onChange={(e) => setStepsToReproduce(e.target.value)}
                    />
                  </div>
                )}

                {/* Code Snippet */}
                <div className="report-field">
                  <label className="report-label">
                    <Code size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Arduino / C++ / MicroPython Code Snippet <span className="field-hint">(Optional)</span>
                  </label>
                  <textarea
                    className="report-textarea report-code-textarea"
                    rows={4}
                    placeholder="// Paste minimal Arduino / MicroPython sketch here..."
                    value={codeSnippet}
                    onChange={(e) => setCodeSnippet(e.target.value)}
                  />
                </div>

                {/* Screenshot / File Attachment */}
                <div className="report-field">
                  <label className="report-label">
                    <Paperclip size={13} style={{ display: 'inline', marginRight: 4 }} />
                    Screenshot or Circuit Attachment <span className="field-hint">(Optional &bull; PNG, JPG, or PDF up to 2.5 MB)</span>
                  </label>
                  <div className="attachment-upload-zone">
                    <input
                      type="file"
                      id="bug-attachment-input"
                      className="attachment-file-input"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleFileUpload}
                    />
                    <label htmlFor="bug-attachment-input" className="attachment-upload-label">
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
                          <strong>Click to upload</strong> or drag and drop circuit screenshot
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* ── FOOTER ──────────────────────────────────────────────────────── */}
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
    max-width: 1020px;
    height: 88vh;
    max-height: 820px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 28px 70px rgba(0, 0, 0, 0.6);
    animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    overflow: hidden;
  }
  @keyframes modalSlideUp {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  .report-modal-header {
    padding: 11px 24px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-shrink: 0;
  }
  .report-modal-title {
    margin: 0 0 2px;
    font-size: 16.5px;
    font-weight: 700;
    font-family: 'Space Grotesk', sans-serif;
    color: var(--text);
  }
  .report-modal-sub {
    margin: 0;
    font-size: 12px;
    color: var(--text2);
  }
  .report-close-btn {
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
  .report-close-btn:hover {
    color: var(--text);
    border-color: var(--border2);
  }

  .report-modal-form {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ── Studio 2-Column Grid Layout ──────────────────────────────────── */
  .report-studio-grid {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  @media (max-width: 768px) {
    .report-studio-grid {
      flex-direction: column;
      overflow-y: auto;
    }
  }

  /* Left Column: Meta & Identity (~300px) */
  .report-col-meta {
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
    .report-col-meta {
      width: 100%;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }
  }

  /* Right Column: Technical Core (Expanded) */
  .report-col-content {
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
  .report-col-content::-webkit-scrollbar {
    width: 6px;
  }
  .report-col-content::-webkit-scrollbar-thumb {
    background: var(--border2);
    border-radius: 99px;
  }

  /* ── Vertical Type Switcher in Column 1 ────────────────────────────── */
  .report-type-vertical {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .type-v-btn {
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
  .type-v-btn:hover {
    color: var(--text);
    border-color: var(--border2);
  }
  .type-v-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .type-v-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--text);
  }
  .type-v-desc {
    font-size: 11px;
    color: var(--text2);
    line-height: 1.3;
  }
  .type-v-btn-active.v-bug {
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.4);
    color: #ef4444;
  }
  .type-v-btn-active.v-bug .type-v-title {
    color: #ef4444;
  }
  .type-v-btn-active.v-feature {
    background: rgba(56, 189, 248, 0.12);
    border-color: rgba(56, 189, 248, 0.4);
    color: #38bdf8;
  }
  .type-v-btn-active.v-feature .type-v-title {
    color: #38bdf8;
  }

  /* Help Guide Box in Col 1 */
  .report-guide-box {
    padding: 10px 12px;
    border-radius: 8px;
    background: rgba(56, 189, 248, 0.05);
    border: 1px solid rgba(56, 189, 248, 0.18);
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--text2);
    margin-top: auto;
  }
  .report-guide-box strong {
    color: var(--accent, #38bdf8);
  }

  .report-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .report-row {
    display: flex;
    gap: 14px;
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
    padding: 12px 16px;
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
    color: #10b981;
    font-weight: 600;
    font-family: monospace;
    font-size: 12.5px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 400px;
  }
  .attachment-clear-btn {
    margin-left: auto;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    cursor: pointer;
    position: relative;
    z-index: 3;
  }
  .attachment-clear-btn:hover {
    background: rgba(239, 68, 68, 0.25);
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
    padding: 9px 24px;
    border-top: 1px solid var(--border);
    background: rgba(10, 16, 28, 0.9);
    flex-shrink: 0;
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
  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }

  .modal-btn {
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
