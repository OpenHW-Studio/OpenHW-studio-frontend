import React from 'react';
import { Btn } from '../Btn';

function SimulatorDialogsGroupBase({
  activeUser,
  showShareDialog,
  setShowShareDialog,
  isSharingSimulation,
  shareUrl,
  handleCopyShareUrl,
  shareCopied,
  shareVisibility,
  setShareVisibility,
  shareLinkType,
  setShareLinkType,
  handleGenerateShareUrl,
  showSaveDialog,
  setShowSaveDialog,
  saveDialogName,
  setSaveDialogName,
  handleConfirmSave,
  showFirmwareDownloadDialog,
  setShowFirmwareDownloadDialog,
  firmwareDownloadTarget,
  setFirmwareDownloadTarget,
  firmwareBoardOptions,
  handleDownloadFirmware,
  showFirmwareUploadDialog,
  setShowFirmwareUploadDialog,
  boardComponentMap,
  normalizeBoardKind,
  toggleBoardFirmwareSource,
  setFirmwareUploadTarget,
  firmwareUploadInputRef,
  firmwareUploadTarget,
  applyUploadedFirmwareToBoard,
}) {
  return (
    <>
      {showShareDialog && ['teacher', 'user', 'admin'].includes(activeUser?.role) && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowShareDialog(false)} role="dialog" aria-modal="true" aria-label="Share simulation">
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl w-[540px] max-w-[90vw] shadow-[0_12px_50px_rgba(0,0,0,.5)] flex flex-col gap-5" style={{ padding: '10px' }} onClick={(event) => event.stopPropagation()}>
            <div className="flex justify-between items-center mb-1">
              <div className="text-xl font-bold text-[var(--text)]">Share Simulation</div>
              <button
                onClick={() => setShowShareDialog(false)}
                className="text-[var(--text3)] hover:text-[var(--text)] transition-colors p-2 -mr-2"
                aria-label="Close share dialog"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <p className="text-sm text-[var(--text3)] leading-relaxed m-0">
              Distribute your interactive learning module by generating a secure link. Choose the visibility level to control who can access this curriculum asset.
            </p>

            <div>
              <label className="text-sm font-semibold text-[var(--text2)] block mb-2">Visibility Level</label>
              <select
                className="w-full bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3.5 py-2 rounded-lg text-sm mb-1 outline-none font-inherit"
                value={shareVisibility}
                onChange={(e) => setShareVisibility(e.target.value)}
                disabled={isSharingSimulation}
              >
                <option value="public">Public (Anyone with the link can view)</option>
                <option value="private">Private (Restricted access)</option>
              </select>
            </div>

            <div className="flex items-center justify-between py-1 border-t border-b border-[var(--border)] my-1">
              <div>
                <span className="text-sm font-semibold text-[var(--text2)] block">Live Link</span>
                <span className="text-xs text-[var(--text3)]">Automatically updates when you save changes</span>
              </div>
              <button
                type="button"
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  shareLinkType === "live" ? "bg-[var(--accent)]" : "bg-[var(--border)]"
                }`}
                onClick={() => {
                  const nextType = shareLinkType === "live" ? "snapshot" : "live";
                  setShareLinkType(nextType);
                }}
                disabled={isSharingSimulation}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    shareLinkType === "live" ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div>
              <div className="text-sm font-semibold text-[var(--text2)] block mb-3">Generated Access Link</div>
              <div className="flex items-center gap-4 bg-[var(--card)] border border-[var(--border)] rounded-lg" style={{ padding: '10px' }}>
                <svg className="text-[var(--text3)] shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.2 4.73" />
                  <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.63-1.63" />
                </svg>
                <span className="text-[15px] text-[var(--text)] flex-1 truncate select-all">
                  {isSharingSimulation ? 'Creating secure link...' : (shareUrl || 'Configure visibility and click "Generate Link" below.')}
                </span>
                {shareUrl && (
                  <button type="button" className="text-[var(--text3)] hover:text-[var(--accent)] transition-colors shrink-0 p-1.5" onClick={handleCopyShareUrl} aria-label="Copy share URL" title="Copy to clipboard">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-3 pt-5 border-t border-[var(--border)]">
              <Btn onClick={() => setShowShareDialog(false)}>Close</Btn>
              {shareUrl ? (
                <Btn color="var(--accent)" onClick={handleCopyShareUrl}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="18" cy="5" r="3" />
                      <circle cx="6" cy="12" r="3" />
                      <circle cx="18" cy="19" r="3" />
                      <path d="M8.59 13.51l6.83 3.98" />
                      <path d="M15.41 6.51l-6.82 3.98" />
                    </svg>
                    {shareCopied ? 'Copied!' : 'Copy URL'}
                  </div>
                </Btn>
              ) : (
                <Btn color="var(--accent)" onClick={handleGenerateShareUrl} disabled={isSharingSimulation}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.2 4.73" />
                      <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07l1.63-1.63" />
                    </svg>
                    {isSharingSimulation ? 'Generating...' : 'Generate Link'}
                  </div>
                </Btn>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[360px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-3.5 text-[var(--text)]">Save Project</div>
            <input
              autoFocus
              className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs w-full mb-2 outline-none font-inherit box-border" style={{ marginBottom: 16, fontSize: 14, padding: '10px 12px' }}
              placeholder="Project name..."
              value={saveDialogName}
              onChange={e => setSaveDialogName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleConfirmSave(); if (e.key === 'Escape') setShowSaveDialog(false); }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowSaveDialog(false)}>Cancel</Btn>
              <Btn color="var(--accent)" onClick={handleConfirmSave}>Save</Btn>
            </div>
          </div>
        </div>
      )}

      {showFirmwareDownloadDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowFirmwareDownloadDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[390px] shadow-[0_8px_40px_rgba(0,0,0,.4)]" onClick={e => e.stopPropagation()}>
            <div className="text-base font-bold mb-2 text-[var(--text)]">Download Firmware</div>
            <div className="text-xs text-[var(--text3)] mb-4">
              Choose a board firmware artifact to download, or download all compiled board firmwares.
            </div>

            <label className="text-xs font-semibold text-[var(--text2)] block mb-2">Target</label>
            <select
              className="w-full bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3 py-2 rounded-lg text-sm mb-4"
              value={firmwareDownloadTarget}
              onChange={(e) => setFirmwareDownloadTarget(e.target.value)}
            >
              <option value="__latest__">Latest compiled firmware</option>
              {firmwareBoardOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
              <option value="__all__">All boards</option>
            </select>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Btn onClick={() => setShowFirmwareDownloadDialog(false)}>Cancel</Btn>
              <Btn
                color="var(--accent)"
                onClick={async () => {
                  await handleDownloadFirmware(firmwareDownloadTarget || '__latest__');
                  setShowFirmwareDownloadDialog(false);
                }}
              >
                Download
              </Btn>
            </div>
          </div>
        </div>
      )}

      {showFirmwareUploadDialog && (
        <div className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]" onClick={() => setShowFirmwareUploadDialog(false)}>
          <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[580px] max-w-[90vw] shadow-[0_12px_50px_rgba(0,0,0,.5)] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <div className="text-lg font-bold text-[var(--text)]">Board Firmware Manager</div>
              <button
                onClick={() => setShowFirmwareUploadDialog(false)}
                className="text-[var(--text3)] hover:text-[var(--text)] transition-colors p-1"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="text-xs text-[var(--text3)] mb-8 leading-relaxed">
              Toggle between using the online code editor or a custom uploaded firmware binary (.hex/.uf2).
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              {firmwareBoardOptions.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-[var(--border)] rounded-xl opacity-60">
                  <div className="text-[var(--text3)] text-sm">No programmable boards found on canvas.</div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {firmwareBoardOptions.map((option) => {
                    const boardComp = boardComponentMap.get(option.id);
                    const attrs = boardComp?.attrs || {};
                    const useUploaded = !!attrs.useUploadedFirmware;
                    const firmwareName = attrs.firmwareArtifactName || '';
                    const hasFirmware = !!(attrs.firmwareHex || attrs.hex);
                    const kind = normalizeBoardKind(boardComp?.type || '');

                    return (
                      <div key={option.id} className="bg-[var(--card)] border border-[var(--border)] p-4 rounded-xl flex items-center justify-between gap-6 transition-all hover:border-[var(--accent)]/30 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-[13px] text-[var(--text)] truncate">{option.id}</span>
                            <span className="px-1.5 py-0.5 bg-[var(--bg2)] border border-[var(--border)] rounded text-[9px] uppercase text-[var(--text3)] font-bold tracking-wider">
                              {kind}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${useUploaded && hasFirmware ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-blue-500 op-40'}`} />
                            <span className="text-[10px] text-[var(--text2)]">
                              Source: <strong className={useUploaded && hasFirmware ? 'text-[var(--accent)]' : 'text-[var(--text)]'}>{useUploaded && hasFirmware ? 'Uploaded Binary' : 'Code Editor'}</strong>
                            </span>
                          </div>
                          {hasFirmware && (
                            <div className="mt-2 text-[9px] text-[var(--text3)] flex items-center gap-1.5 bg-[var(--bg)]/40 px-2 py-1 rounded inline-flex">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                              <span className="truncate max-w-[180px]">{firmwareName || 'Custom Upload'}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <Btn
                            onClick={() => toggleBoardFirmwareSource(option.id, !useUploaded)}
                            disabled={!hasFirmware}
                            color={useUploaded ? 'var(--accent)' : ''}
                            title={!hasFirmware ? 'Upload a binary first to use this source override' : (useUploaded ? 'Switch to Code Editor' : 'Use Uploaded Binary')}
                          >
                            <span className="text-[11px] font-bold">{useUploaded ? 'Using Upload' : 'Use Upload'}</span>
                          </Btn>

                          <Btn
                            onClick={() => {
                              setFirmwareUploadTarget(option.id);
                              firmwareUploadInputRef.current?.click();
                            }}
                            iconOnly
                            title="Upload New Binary"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
                          </Btn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-8 flex justify-end gap-3 pt-5 border-t border-[var(--border)]">
              <Btn onClick={() => setShowFirmwareUploadDialog(false)}>
                Close
              </Btn>
            </div>
          </div>
        </div>
      )}

      <input
        ref={firmwareUploadInputRef}
        type="file"
        accept=".hex,.uf2"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && firmwareUploadTarget) {
            applyUploadedFirmwareToBoard(firmwareUploadTarget, file);
          }
        }}
      />
    </>
  );
}

export const SimulatorDialogsGroup = React.memo(SimulatorDialogsGroupBase);
