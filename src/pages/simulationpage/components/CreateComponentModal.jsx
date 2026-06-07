import React from 'react';

function CreateComponentModalBase({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={onClose}>
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
        <div className="text-base font-bold mb-3.5 text-[var(--text)]">Create Component</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>
          To create a custom component, build a ZIP package with <code>manifest.json</code>, <code>ui.tsx</code>, <code>logic.ts</code>, and optionally <code>validation.ts</code>, then upload via <strong>Upload ZIP to Test</strong>.
        </p>
        <button
          onClick={onClose}
          style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Got it
        </button>
      </div>
    </div>
  );
}

export const CreateComponentModal = React.memo(CreateComponentModalBase);
