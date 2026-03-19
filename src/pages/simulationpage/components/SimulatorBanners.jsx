import React from 'react';

export function AdminPreviewBanner({ previewBanner, onDismiss }) {
  if (!previewBanner) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] flex items-center justify-between bg-gradient-to-r from-amber-800 to-amber-700 px-5 py-2.5 text-sm text-white shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
      <span className="font-mono">
        🧪 <strong>Admin Preview Mode</strong> - Component{' '}
        <strong className="text-amber-200">{previewBanner.label}</strong> (
        <code className="rounded bg-black/30 px-1.5 py-0.5">{previewBanner.id}</code>) is injected in{' '}
        <strong>browser memory only</strong>. It is NOT approved or installed on the backend.
      </span>
      <button
        onClick={onDismiss}
        className="cursor-pointer rounded border-0 bg-black/30 px-2.5 py-1 text-sm text-white"
      >
        ✕ Dismiss
      </button>
    </div>
  );
}

export function GuestModeBanner({ onSignIn, onDismiss }) {
  return (
    <div className="mx-2 mt-2 flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--text2)]">
      <div className="flex-1">
        <strong>Guest Mode</strong> - Your work is auto-saved locally in your browser. Click{' '}
        <strong>My Projects</strong> to see all saved circuits. Sign in to access your projects from any device.
        <button
          onClick={onSignIn}
          className="ml-2 cursor-pointer rounded border border-[var(--accent)] bg-transparent px-2 py-1 text-xs font-semibold text-[var(--accent)]"
        >
          Sign in -&gt;
        </button>
      </div>
      <button
        onClick={onDismiss}
        title="Dismiss"
        className="cursor-pointer rounded border-0 bg-transparent px-1 text-sm text-[var(--text3)]"
      >
        ✕
      </button>
    </div>
  );
}

export function WiringHintBanner({ wireStart }) {
  if (!wireStart) return null;

  return (
    <div className="mx-2 mt-2 rounded-[var(--radius)] border border-[rgba(255,170,0,.3)] bg-[rgba(255,170,0,.12)] px-3 py-2 text-xs text-[var(--orange)]">
      〰 <strong>Wiring in progress</strong> - Click another pin to connect. Press Esc to cancel.
      <span className="ml-3">
        🔵 Started from <strong>{wireStart.compId} [{wireStart.pinLabel}]</strong>
      </span>
    </div>
  );
}
