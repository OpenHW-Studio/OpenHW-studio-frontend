import React, { useState } from 'react';

export default function AutofixPreviewPanel({ project, validationErrors = [], runAutoFixAll, onApplyPlan, className = '' }) {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  const handlePreview = async () => {
    if (!runAutoFixAll) return;
    setLoading(true);
    try {
      const res = await runAutoFixAll(project, validationErrors, { apply: false, quiet: true });
      setPreview(res);
    } catch (e) {
      setPreview({ error: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  const handleApplyAll = async () => {
    if (!runAutoFixAll) return;
    setLoading(true);
    try {
      const res = await runAutoFixAll(project, validationErrors, { apply: true, quiet: false });
      if (onApplyPlan) onApplyPlan(res);
      setPreview(res);
    } catch (e) {
      setPreview({ error: e.message || String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`autofix-preview-panel bg-[var(--bg2)] border border-[var(--border)] p-3 rounded ${className}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>Autofix Preview</strong>
        <div>
          <button className="btn" onClick={handlePreview} disabled={loading || validationErrors.length === 0} style={{ marginRight: 8 }}>
            {loading ? 'Working…' : 'Preview fixes'}
          </button>
          <button className="btn btn-primary" onClick={handleApplyAll} disabled={loading || !preview || (preview && !preview.applied)}>
            Apply All
          </button>
        </div>
      </div>

      <div style={{ marginTop: 10, maxHeight: 280, overflow: 'auto' }}>
        {!preview && <div style={{ color: 'var(--text3)' }}>{validationErrors.length === 0 ? 'No issues detected' : 'Click "Preview fixes" to compute a plan.'}</div>}
        {preview && preview.error && <div style={{ color: 'var(--danger)' }}>Error: {preview.error}</div>}
        {preview && !preview.error && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>Applied: {preview.appliedCount} · Skipped: {preview.skippedCount}</div>
            <ul style={{ marginTop: 8 }}>
              {(preview.appliedPlan || []).map((p, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  <div style={{ fontWeight: 600 }}>{p.issue?.message || p.issue?.remediation || `Issue ${i + 1}`}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.changeSet ? `${p.changeSet.addedComponents?.length || 0} components, ${p.changeSet.addedConnections?.length || 0} wires` : ''} {p.verification ? `(conf ${Math.round((p.verification.confidence || 0) * 100)}%)` : ''}</div>
                </li>
              ))}
            </ul>
            {preview.skipped && preview.skipped.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 12 }}>Skipped fixes ({preview.skipped.length})</summary>
                <ul>
                  {preview.skipped.map((s, i) => <li key={i} style={{ fontSize: 12, color: 'var(--text3)' }}>{s.issue?.message || s.reason}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
