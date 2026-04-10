import React, { useEffect, useRef, useState } from 'react';
import { Btn } from './Btn';

export function TopToolbox(props) {
  const { board, setBoard, isRunning, isPaused, handleRun, handlePause, handleResume, handleStop, isCompiling, assessmentMode, assessmentProjectName, isSubmittingAssessment, handleAssessmentSubmit, undo, redo, selected, rotateComponent, theme, toggleTheme, showViewPanel, setShowViewPanel, viewPanelSection, setViewPanelSection, schematicDataUrl, setSchematicDataUrl, schematicLoading, setSchematicLoading, downloadSchematicPng, downloadSchematicPdf, generateSchematic, downloadCompCsv, importFileRef, downloadPng, importPng, handleSave, isExporting, handleShareSimulation, isSharingSimulation, refreshProjectList, showProjectsDropdown, setShowProjectsDropdown, handleNewProject, handleStartRename, handleConfirmRename, renamingProjectId, setRenamingProjectId, renameValue, setRenameValue, handleLoadProject, handleDeleteProject, handleBackupWorkflow, backupRestoreInputRef, handleRestoreWorkflow, handleSyncToCloud, user, navigate, isAuthenticated, myProjects, currentProjectId, formatProjectDate, saveHistory, setWires, setComponents, setSelected, history, components, wires, webSerialSupported, hardwareBoards, hardwareBoardId, setHardwareBoardId, hardwarePortPath, setHardwarePortPath, resolvedHardwarePort, hardwareAvailablePorts, showAllHardwarePorts, setShowAllHardwarePorts, refreshHardwarePorts, isLoadingHardwarePorts, hardwareBaudRate, setHardwareBaudRate, hardwareResetMethod, setHardwareResetMethod, connectHardwareSerial, disconnectHardwareSerial, uploadToHardware, hardwareConnected, hardwareConnecting, isUploadingHardware, hardwareStatus, setShowProjectsSidebar, setProjectsSidebarTab } = props;

  const viewPanelRef = useRef(null);
  const connectPanelRef = useRef(null);
  const [showConnectPanel, setShowConnectPanel] = useState(false);
  const [showAdvancedFlash, setShowAdvancedFlash] = useState(false);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (showViewPanel && viewPanelRef.current && !viewPanelRef.current.contains(event.target)) {
        setShowViewPanel(false);
      }

      if (showConnectPanel && connectPanelRef.current && !connectPanelRef.current.contains(event.target)) {
        setShowConnectPanel(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showViewPanel, showConnectPanel, setShowViewPanel]);

  return (
<header className="flex items-center gap-2.5 px-4 py-2.5 bg-[var(--bg2)] border-b border-[var(--border)] shrink-0 flex-wrap">
        <button className="bg-transparent border-none text-[var(--accent)] text-base font-bold cursor-pointer flex items-center gap-1.5 font-inherit" onClick={() => navigate('/')}> OpenHW-Studio</button>
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <select className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-3 py-1.5 rounded-lg text-[13px] cursor-pointer font-inherit" value={board} onChange={e => setBoard(e.target.value)}>
            <option value="arduino_uno">Arduino Uno</option>
            <option value="pico">Raspberry Pi Pico</option>
            <option value="esp32">ESP32</option>
          </select>

          {/* RUN button */}
          <Btn
            color={isRunning ? (isPaused ? 'var(--orange)' : 'var(--green)') : 'var(--green)'}
            disabled={isRunning}
            onClick={!isRunning ? handleRun : undefined}
            title={isRunning ? (isCompiling ? 'Compiling…' : isPaused ? 'Paused' : 'Running') : 'Run'}
          >
            {isRunning ? (
              isCompiling ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', flexShrink: 0 }}>
                    <path d="M21 12a9 9 0 1 1-4.5-7.8"/>
                  </svg>
                  Compiling…
                </>
              ) : isPaused ? 'Paused' : 'Running…'
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" style={{ flexShrink: 0 }}><polygon points="2,1 11,6 2,11"/></svg>
                Run
              </>
            )}
          </Btn>

          {/* STOP button — SVG icon only */}
          <Btn color={isRunning ? 'var(--red)' : undefined} disabled={!isRunning} onClick={isRunning ? handleStop : undefined} title="Stop" iconOnly>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect width="13" height="13" rx="2"/></svg>
          </Btn>

          {/* PAUSE / RESUME button — visible only when running and not still compiling */}
          {isRunning && !isCompiling && (
            <Btn
              color={isPaused ? 'var(--green)' : 'var(--orange)'}
              onClick={isPaused ? handleResume : handlePause}
              title={isPaused ? 'Resume' : 'Pause'}
              iconOnly
            >
              {isPaused ? (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><polygon points="2,1 12,6.5 2,12"/></svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="currentColor"><rect x="1.5" y="1" width="3.5" height="11" rx="1"/><rect x="8" y="1" width="3.5" height="11" rx="1"/></svg>
              )}
            </Btn>
          )}

          {assessmentMode && (
            <Btn
              color="var(--accent)"
              disabled={isSubmittingAssessment || !assessmentProjectName}
              onClick={!isSubmittingAssessment ? handleAssessmentSubmit : undefined}
              title={!assessmentProjectName ? 'Assessment project is missing' : 'Submit assessment'}
            >
              {isSubmittingAssessment ? 'Submitting...' : 'Submit Assessment'}
            </Btn>
          )}

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* UNDO — SVG icon only */}
          <Btn onClick={undo} disabled={history.past.length === 0 || isRunning} title="Undo" iconOnly>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M7.53033 3.46967C7.82322 3.76256 7.82322 4.23744 7.53033 4.53033L5.81066 6.25H15C18.1756 6.25 20.75 8.82436 20.75 12C20.75 15.1756 18.1756 17.75 15 17.75H8.00001C7.58579 17.75 7.25001 17.4142 7.25001 17C7.25001 16.5858 7.58579 16.25 8.00001 16.25H15C17.3472 16.25 19.25 14.3472 19.25 12C19.25 9.65279 17.3472 7.75 15 7.75H5.81066L7.53033 9.46967C7.82322 9.76256 7.82322 10.2374 7.53033 10.5303C7.23744 10.8232 6.76256 10.8232 6.46967 10.5303L3.46967 7.53033C3.17678 7.23744 3.17678 6.76256 3.46967 6.46967L6.46967 3.46967C6.76256 3.17678 7.23744 3.17678 7.53033 3.46967Z" />
            </svg>
          </Btn>

          {/* REDO — SVG icon only */}
          <Btn onClick={redo} disabled={history.future.length === 0 || isRunning} title="Redo" iconOnly>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7H9.00001C6.23858 7 4 9.23857 4 12C4 14.7614 6.23858 17 9 17H16M20 7L17 4M20 7L17 10" />
            </svg>
          </Btn>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* DELETE — SVG icon only */}
          <Btn color={selected ? 'var(--red)' : undefined} disabled={!selected || isRunning} onClick={() => {
            if (!selected || isRunning) return;
            saveHistory();
            if (selected.match(/^w\d+$/)) {
              setWires(prev => prev.filter(w => w.id !== selected));
            } else {
              setComponents(prev => prev.filter(c => c.id !== selected))
              setWires(prev => prev.filter(w => !w.from.startsWith(selected + ':') && !w.to.startsWith(selected + ':')))
            }
            setSelected(null)
          }} title="Delete selected" iconOnly>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
              <path d="M9 6V4h6v2"/>
            </svg>
          </Btn>

          {/* ROTATE — SVG icon only, visible when a component is selected */}
          {selected && components.find(c => c.id === selected) && (
            <Btn onClick={() => rotateComponent(selected)} disabled={isRunning} title="Rotate 90°" iconOnly>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </Btn>
          )}

          {/* THEME TOGGLE — SVG icon only */}
          <Btn onClick={toggleTheme} title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} iconOnly>
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </Btn>

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 4px' }} />

          {/* VIEW PANEL — button + dropdown */}
          <div ref={viewPanelRef} style={{ position: 'relative' }}>
            <Btn onClick={() => setShowViewPanel(v => !v)} title="View schematic or component list">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              View
            </Btn>
            {/* Dropdown panel */}
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 300,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 9999,
              overflow: 'hidden',
              maxHeight: showViewPanel ? 660 : 0,
              opacity: showViewPanel ? 1 : 0,
              transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
              pointerEvents: showViewPanel ? 'auto' : 'none',
            }}>
              {/* Panel header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 10px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>View</span>
                <button onClick={() => setShowViewPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
              </div>

              {/* ── Schematic View accordion ── */}
              <div>
                <button
                  onClick={() => {
                    if (viewPanelSection === 'schematic') {
                      setViewPanelSection(null);
                      setSchematicDataUrl(null);
                      setSchematicLoading(false);
                    } else {
                      setViewPanelSection('schematic');
                      generateSchematic();
                    }
                  }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px', border: 'none', borderBottom: '1px solid var(--border)',
                    background: viewPanelSection === 'schematic' ? 'rgba(100,180,255,.07)' : 'var(--bg2)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
                    </svg>
                    Schematic View
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    {viewPanelSection === 'schematic'
                      ? <path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      : <path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    }
                  </svg>
                </button>
                {viewPanelSection === 'schematic' && (
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    {schematicLoading ? (
                      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text3)', fontSize: 12 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'toolbar-spin 0.9s linear infinite', display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}><path d="M21 12a9 9 0 1 1-4.5-7.8"/></svg>
                        Capturing circuit…
                      </div>
                    ) : schematicDataUrl ? (
                      <>
                        <img src={schematicDataUrl} alt="Schematic" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 10, display: 'block' }} />
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={downloadSchematicPng} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>↓ PNG</button>
                          <button onClick={downloadSchematicPdf} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit' }}>↓ PDF</button>
                          <button onClick={generateSchematic} style={{ flex: 1, padding: '7px 4px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }} title="Recapture">↺ Refresh</button>
                        </div>
                      </>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text3)', fontSize: 12 }}>Capture failed. Try again.</div>
                    )}
                  </div>
                )}
              </div>

              {/* ── Component List accordion ── */}
              <div>
                <button
                  onClick={() => setViewPanelSection(s => s === 'components' ? null : 'components')}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '11px 16px', border: 'none',
                    background: viewPanelSection === 'components' ? 'rgba(100,180,255,.07)' : 'var(--bg2)',
                    color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
                    </svg>
                    Component List
                  </span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    {viewPanelSection === 'components'
                      ? <path d="M2 7l3-4 3 4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      : <path d="M2 3l3 4 3-4" stroke="var(--text3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    }
                  </svg>
                </button>
                {viewPanelSection === 'components' && (
                  <div style={{ padding: '12px 16px' }}>
                    {components.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 12 }}>No components on canvas.</div>
                    ) : (
                      <>
                        <div style={{ overflowX: 'auto', marginBottom: 10, borderRadius: 6, border: '1px solid var(--border)' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'var(--bg3)' }}>
                                {['#', 'Component', 'Type', 'Qty'].map(h => (
                                  <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const counts = {};
                                components.forEach(c => {
                                  if (!counts[c.type]) counts[c.type] = { type: c.type, label: c.label, count: 0 };
                                  counts[c.type].count++;
                                });
                                return Object.values(counts).map((row, i) => (
                                  <tr key={row.type} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                                    <td style={{ padding: '7px 10px', color: 'var(--text3)', fontSize: 11 }}>{i + 1}</td>
                                    <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text)' }}>{row.label}</td>
                                    <td style={{ padding: '7px 10px', color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{row.type}</td>
                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: 'var(--accent)' }}>{row.count}</td>
                                  </tr>
                                ));
                              })()}
                            </tbody>
                          </table>
                        </div>
                        <button
                          onClick={downloadCompCsv}
                          style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Download CSV
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT SIDE — right to left: Sign In/User, My Projects, Save, Export, Import */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div ref={connectPanelRef} style={{ position: 'relative' }}>
            <Btn
              color={hardwareConnected ? 'var(--green)' : undefined}
              onClick={() => setShowConnectPanel(v => !v)}
              title="Connect hardware and flash over bootloader"
            >
              Connect
            </Btn>
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, width: 320,
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.45)', zIndex: 10000,
              overflow: 'hidden',
              maxHeight: showConnectPanel ? 460 : 0,
              opacity: showConnectPanel ? 1 : 0,
              transition: 'max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
              pointerEvents: showConnectPanel ? 'auto' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Hardware Connect</span>
                <button onClick={() => setShowConnectPanel(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
              </div>

              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!webSerialSupported && (
                  <div style={{ fontSize: 12, color: 'var(--orange)', lineHeight: 1.45 }}>
                    Web Serial is not available in this browser. Flash upload can still work via backend port, but serial monitor connect needs Chrome/Edge over HTTPS or localhost.
                  </div>
                )}
                <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Board from Canvas</label>
                      <select
                        value={hardwareBoardId}
                        onChange={(e) => setHardwareBoardId(e.target.value)}
                        style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                      >
                        {hardwareBoards.length === 0 ? (
                          <option value="">No programmable board on canvas</option>
                        ) : hardwareBoards.map((b) => (
                          <option key={b.id} value={b.id}>{b.id} ({b.type})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 11, color: 'var(--text3)' }}>Detected Port (Auto)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ flex: 1, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', minHeight: 32, display: 'flex', alignItems: 'center' }}>
                          {resolvedHardwarePort || 'No ports found'}
                        </div>
                        <Btn onClick={refreshHardwarePorts} disabled={isLoadingHardwarePorts} title="Refresh available serial ports">{isLoadingHardwarePorts ? '...' : '↻'}</Btn>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text3)' }}>
                        <input
                          id="show-all-ports"
                          type="checkbox"
                          checked={showAllHardwarePorts}
                          onChange={(e) => setShowAllHardwarePorts(e.target.checked)}
                        />
                        <label htmlFor="show-all-ports" style={{ cursor: 'pointer' }}>Show all serial ports</label>
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.35 }}>
                        Off: only likely dev boards are shown. On: include Bluetooth and other virtual COM ports.
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAdvancedFlash((v) => !v)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}
                    >
                      <span>Advanced</span>
                      <span>{showAdvancedFlash ? '▴' : '▾'}</span>
                    </button>

                    {showAdvancedFlash && (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Port Override (optional)</label>
                          <select
                            value={hardwarePortPath}
                            onChange={(e) => setHardwarePortPath(e.target.value)}
                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }}
                          >
                            <option value="">Auto ({resolvedHardwarePort || 'none'})</option>
                            {(hardwareAvailablePorts || []).map((p) => (
                              <option key={p.port} value={p.port}>{p.label || p.port}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Baud Rate</label>
                          <select
                            value={hardwareBaudRate}
                            onChange={(e) => setHardwareBaudRate(e.target.value)}
                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                          >
                            {['9600', '19200', '38400', '57600', '115200', '230400', '460800', '921600'].map((b) => (
                              <option key={b} value={b}>{b}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <label style={{ fontSize: 11, color: 'var(--text3)' }}>Reset Method</label>
                          <select
                            value={hardwareResetMethod}
                            onChange={(e) => setHardwareResetMethod(e.target.value)}
                            style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 12 }}
                          >
                            <option value="normal">Normal (RTS/DTR)</option>
                            <option value="no-rts-dtr">No RTS/DTR</option>
                          </select>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      {!hardwareConnected ? (
                        <Btn
                          color="var(--accent)"
                          onClick={connectHardwareSerial}
                          disabled={!webSerialSupported || hardwareConnecting || !hardwareBoardId || hardwareBoards.length === 0}
                          title="Open browser serial device picker"
                        >
                          {hardwareConnecting ? 'Connecting...' : 'Connect'}
                        </Btn>
                      ) : (
                        <Btn color="var(--red)" onClick={disconnectHardwareSerial} title="Close serial connection">Disconnect</Btn>
                      )}

                      <Btn
                        color="var(--green)"
                        onClick={uploadToHardware}
                        disabled={!hardwareBoardId || isUploadingHardware || hardwareBoards.length === 0}
                        title="Flash selected board using backend bootloader uploader"
                      >
                        {isUploadingHardware ? 'Uploading...' : 'Upload'}
                      </Btn>
                    </div>

                    <div style={{ fontSize: 11, color: hardwareConnected ? 'var(--green)' : 'var(--text3)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      {hardwareStatus}
                    </div>
                </>
              </div>
            </div>
          </div>

          {/* Hidden file inputs */}
          <input ref={importFileRef} type="file" accept=".png,image/png,.json,application/json" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) importPng(e.target.files[0]); }} />
          <input ref={backupRestoreInputRef} type="file" accept=".zip" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleRestoreWorkflow(e.target.files[0]); e.target.value = ''; } }} />

          {/* Import PNG or JSON */}
          <Btn color="var(--orange)" onClick={() => importFileRef.current?.click()} title="Import a previously exported OpenHW-Studio PNG or JSON project file to restore the circuit"> Import PNG/JSON</Btn>
          {/* Export PNG */}
          <Btn color="var(--purple)" onClick={downloadPng} disabled={isExporting} title="Download circuit as PNG with embedded metadata">
            {isExporting ? ' Exporting...' : ' Export PNG'}
          </Btn>
          {/* Save */}
          <Btn color="var(--accent)" onClick={handleSave} title="Save current project"> Save</Btn>
          <Btn
            color="var(--green)"
            onClick={handleShareSimulation}
            disabled={isSharingSimulation}
            title={isAuthenticated ? 'Create a share link for this simulator page' : 'Sign in to share this simulator page'}
          >
            {isSharingSimulation ? 'Sharing...' : 'Share'}
          </Btn>

          <Btn
            onClick={() => {
              refreshProjectList();
              setProjectsSidebarTab('projects');
              setShowProjectsSidebar(v => !v);
            }}
            title="View and manage your saved projects"
          > {isAuthenticated ? (user?.name?.split(' ')[0] || 'User') : 'Local'}</Btn>
        </div>
      </header>
  );
}
