import React from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import { Btn } from './Btn';
import BlocklyEditor from '../../components/BlocklyEditor.jsx';

export function RightPanel(props) {
  const {
    isPanelOpen, panelWidth, isDragging, onMouseDownResize, setIsPanelOpen,
    validationErrors, showValidation, setShowValidation,
    codeTab, setCodeTab, code, setCode, blockXml, setBlocklyXml,
    libQuery, setLibQuery, handleSearchLibraries, isSearchingLib, libMessage, libInstalled, libResults, handleInstallLibrary, installingLib,
    serialPaused, setSerialPaused, isRunning, serialHistory, setSerialHistory, serialOutputRef, serialInput, setSerialInput, sendSerialInput,
    plotterPaused, setPlotterPaused, plotData, setPlotData, selectedPlotPins, setSelectedPlotPins, plotterCanvasRef, serialPlotLabelsRef,
    showConnectionsPanel, wires, updateWireColor, deleteWire
  } = props;

  return (
        <aside className="relative bg-[var(--bg2)] border-l border-[var(--border)] flex flex-col shrink-0 overflow-hidden transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{width: isPanelOpen ? panelWidth : 40, transition: isDragging ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          {/* Drag Handle */}
          {isPanelOpen && (
            <div
              onMouseDown={onMouseDownResize}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 5,
                cursor: 'col-resize',
                zIndex: 10,
                background: 'transparent'
              }}
            />
          )}

          {/* Toggle Button */}
          <button
            onClick={() => setIsPanelOpen(!isPanelOpen)}
            style={{
              position: 'absolute',
              left: isPanelOpen ? 5 : 0,
              top: '50%',
              transform: 'translateY(-50%)',
              height: 48,
              width: 20,
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderLeft: 'none',
              borderRadius: '0 8px 8px 0',
              color: 'var(--text3)',
              cursor: 'pointer',
              zIndex: 11,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '2px 0 8px rgba(0,0,0,0.2)'
            }}
          >
            {isPanelOpen ? '▶' : '◀'}
          </button>

          {isPanelOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', paddingLeft: 12 }}>
              {/* Validation panel */}
              {validationErrors.length > 0 && showValidation && (
                <div className="bg-[var(--bg3)] border-b border-[var(--border)] shrink-0">
                  <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-[var(--orange)]">
                    <span>⚠ Validation ({validationErrors.length})</span>
                    <button className="bg-transparent border-none text-[var(--text3)] cursor-pointer text-sm font-inherit" onClick={() => setShowValidation(false)}>✕</button>
                  </div>
                  {validationErrors.map((err, i) => (
                    <div key={i} className="px-3 py-1.5 text-xs border-l-3 mb-0.5 leading-relaxed" style={{borderLeftColor: err.type === 'error' ? 'var(--red)' : 'var(--orange)',
                    }}>
                      <span style={{ color: err.type === 'error' ? 'var(--red)' : 'var(--orange)' }}>
                        {err.type === 'error' ? '🔴' : '🟡'} {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Wires list */}
              {showConnectionsPanel && (
              <div className="bg-[var(--bg3)] border-b border-[var(--border)] max-h-[140px] overflow-y-auto shrink-0 panel-scroll" >
                <div className="text-[11px] font-bold text-[var(--text3)] uppercase tracking-widest px-3 pt-2 pb-1">Connections ({wires.length})</div>
                {wires.length === 0 ? (
                  <div style={{ padding: '12px 12px 16px', fontSize: 12, color: 'var(--text3)' }}>
                    No wires connected.
                  </div>
                ) : (
                  wires.map(w => (
                    <div key={w.id} className="flex items-center gap-2 px-3 py-1 border-b border-[var(--border)]">
                      <input
                        type="color"
                        value={w.color}
                        onChange={e => updateWireColor(w.id, e.target.value)}
                        style={{ width: 14, height: 14, padding: 0, border: 'none', cursor: 'pointer', background: 'transparent' }}
                        title="Change wire color"
                      />
                      <span style={{ flex: 1, fontSize: 10, color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {w.from} → {w.to}
                      </span>
                      <button className="bg-transparent border-none text-[var(--text3)] cursor-pointer text-xs font-inherit shrink-0" onClick={() => deleteWire(w.id)}>✕</button>
                    </div>
                  ))
                )}
              </div>
              )}

              {/* Code editor */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex border-b border-[var(--border)] shrink-0 overflow-x-auto whitespace-nowrap scrollbar-hide" style={{ display: "flex", gap: "10px" }}>
                  {['code', 'block', 'libraries', 'serial', 'plotter'].map(t => (
                    <button
                      key={t}
                      className={`shrink-0 bg-transparent border-none text-[var(--text3)] font-inherit text-xs cursor-pointer border-b-2 border-transparent transition-all duration-150 ${codeTab === t ? 'text-[var(--accent)] border-b-[var(--accent)]' : ''}`}
                      onClick={() => setCodeTab(t)}
                        style={{ padding: "10px 16px" }}
                    >
                      {t === 'code' ? '{ } Code' : t === 'block' ? 'Block' : t === 'libraries' ? ' Libraries' : t === 'serial' ? ' Serial' : ' Plotter'}
                    </button>
                  ))}
                </div>
                {codeTab === 'code' && (
                  <div className="panel-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
                    <Editor
                      value={code}
                      onValueChange={code => setCode(code)}
                      highlight={code => Prism.highlight(code, Prism.languages.cpp, 'cpp')}
                      padding={14}
                      style={{
                        fontFamily: "'JetBrains Mono',monospace",
                        fontSize: 12,
                        lineHeight: 1.7,
                        minHeight: '100%',
                        color: 'var(--text)',
                        border: 'none',
                        outline: 'none',
                        resize: 'none'
                      }}
                      textareaClassName="editor-textarea"
                    />
                  </div>
                )}
                {codeTab === 'block' && (
                  <BlocklyEditor onExportCode={(generated) => { setCode(generated); setCodeTab('code'); }} />
                )}
                {codeTab === 'libraries' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 12, background: 'var(--bg)' }}>
                    <form onSubmit={handleSearchLibraries} style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                      <input
                        className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit"
                        placeholder="Search for an Arduino library..."
                        value={libQuery}
                        onChange={e => setLibQuery(e.target.value)}
                      />
                      <Btn color="var(--accent)" disabled={isSearchingLib}>
                        {isSearchingLib ? '...' : 'Search'}
                      </Btn>
                    </form>

                    {libMessage && (
                      <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 12, fontSize: 13, background: libMessage.type === 'error' ? 'rgba(255,68,68,0.1)' : 'rgba(0,230,118,0.1)', color: libMessage.type === 'error' ? 'var(--red)' : 'var(--green)', border: `1px solid ${libMessage.type === 'error' ? 'rgba(255,68,68,0.3)' : 'rgba(0,230,118,0.3)'}` }}>
                        {libMessage.text}
                      </div>
                    )}

                    <div className="panel-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>
                      {libResults.length > 0 && <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Search Results</div>}
                      {libResults.map((lib, idx) => (
                        <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--accent)' }}>{lib.name}</div>
                            <Btn
                              color="var(--green)"
                              disabled={installingLib === lib.name}
                              onClick={() => handleInstallLibrary(lib.name)}
                            >
                              {installingLib === lib.name ? 'Installing...' : 'Install'}
                            </Btn>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8, lineHeight: 1.4 }}>{lib.sentence}</div>
                          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                            <span>v{lib.version}</span>
                            <span>{lib.author}</span>
                          </div>
                        </div>
                      ))}

                      {libResults.length === 0 && (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: 1, marginTop: 8 }}>Installed on Host Server</div>
                          {libInstalled.length === 0 ? (
                            <div style={{ fontSize: 13, color: 'var(--text3)' }}>No external libraries installed.</div>
                          ) : (
                            libInstalled.map((lib, idx) => (
                              <div key={idx} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, opacity: 0.85 }}>
                                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{lib.library.name}</div>
                                <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>
                                  <span>v{lib.library.version}</span>
                                  <span>Installed</span>
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {codeTab === 'serial' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
                    {/* Serial Toolbar */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border)] bg-[var(--bg2)] shrink-0">
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                        color: serialPaused ? 'var(--text3)' : 'var(--green)'
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: serialPaused ? 'var(--text3)' : 'var(--green)',
                          boxShadow: serialPaused ? 'none' : '0 0 6px var(--green)',
                          animation: (!serialPaused && isRunning) ? 'pulse 1.2s infinite' : 'none',
                          flexShrink: 0
                        }} />
                        {serialPaused ? 'Paused' : isRunning ? 'Live' : 'Idle'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {serialHistory.length} lines
                      </span>
                      <button
                        className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap"
                        onClick={() => setSerialPaused(p => !p)}
                        title={serialPaused ? 'Resume auto-scroll' : 'Pause auto-scroll'}
                      >
                        {serialPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button
                        className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap" style={{color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                        onClick={() => setSerialHistory([])}
                        title="Clear all output"
                      >
                        🗑 Clear
                      </button>
                    </div>

                    {/* Output Area */}
                    <div ref={serialOutputRef} className="flex-1 overflow-y-auto py-1.5 flex flex-col panel-scroll" >
                      {serialHistory.length === 0 ? (
                        <div style={{ color: 'var(--text3)', fontSize: 12, padding: '20px 0', textAlign: 'center' }}>
                          {isRunning ? 'Waiting for serial output...' : 'Run the simulator to see serial output.'}
                        </div>
                      ) : (
                        serialHistory.map((entry, i) => {
                          const badgeColor = entry.dir === 'rx' ? '#2ecc71' : entry.dir === 'tx' ? '#3498db' : '#888';
                          const badgeBg = entry.dir === 'rx' ? 'rgba(46,204,113,0.12)' : entry.dir === 'tx' ? 'rgba(52,152,219,0.12)' : 'rgba(128,128,128,0.12)';
                          return (
                            <div key={i} className="flex items-start gap-2 px-3 py-0.5 text-[11px] font-mono border-b border-[var(--border)]">
                              <span className="text-[var(--text3)] text-[10px] min-w-[84px] shrink-0 pt-[1px]">{entry.ts || ''}</span>
                              <span className="inline-block text-[9px] font-bold rounded-[3px] px-1 py-[1px] shrink-0 mt-[1px]" style={{ color: badgeColor, background: badgeBg, border: `1px solid ${badgeColor}40` }}>
                                {entry.dir?.toUpperCase() || 'RX'}
                              </span>
                              <span style={{ flex: 1, color: entry.dir === 'tx' ? '#3498db' : entry.dir === 'sys' ? 'var(--text3)' : 'var(--green)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                {entry.text}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* TX Input Row */}
                    <div style={{ display: 'flex', gap: 6, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, background: 'var(--bg2)' }}>
                      <input
                        className="bg-[var(--card)] border border-[var(--border)] text-[var(--text)] px-2.5 py-1.5 rounded-lg text-xs outline-none font-inherit" style={{flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                        placeholder="Send message to Arduino..."
                        value={serialInput}
                        onChange={e => setSerialInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') sendSerialInput(); }}
                        disabled={!isRunning}
                      />
                      <button
                        onClick={sendSerialInput}
                        disabled={!isRunning || !serialInput.trim()}
                        style={{
                          background: (isRunning && serialInput.trim()) ? 'var(--accent)' : 'transparent',
                          border: '1px solid var(--accent)', color: (isRunning && serialInput.trim()) ? '#fff' : 'var(--text3)',
                          borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700,
                          cursor: (isRunning && serialInput.trim()) ? 'pointer' : 'not-allowed',
                          fontFamily: 'inherit', transition: 'all .15s', whiteSpace: 'nowrap'
                        }}
                      >
                        ↑ Send
                      </button>
                    </div>
                  </div>
                )}
                {codeTab === 'plotter' && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'var(--bg)', overflow: 'hidden' }}>
                    {/* Plotter Toolbar */}
                    <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border)] shrink-0">
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                        color: plotterPaused ? 'var(--text3)' : 'var(--green)'
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: plotterPaused ? 'var(--text3)' : 'var(--green)',
                          boxShadow: plotterPaused ? 'none' : '0 0 6px var(--green)',
                        }} />
                        {plotterPaused ? 'Paused' : isRunning ? 'Plotting live...' : 'Idle'}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap"
                        onClick={() => setPlotterPaused(p => !p)}
                        title={plotterPaused ? 'Resume plotting' : 'Pause plotting'}
                      >
                        {plotterPaused ? '▶ Resume' : '⏸ Pause'}
                      </button>
                      <button
                        className="bg-transparent border border-[var(--border)] text-[var(--text2)] rounded-md px-2 py-0.5 text-[11px] cursor-pointer font-inherit whitespace-nowrap" style={{color: 'var(--red)', borderColor: 'rgba(255,68,68,0.3)' }}
                        onClick={() => setPlotData([])}
                        title="Clear plot"
                      >
                        🗑 Clear
                      </button>
                    </div>

                    {/* Pin Selector */}
                    <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>Pins:</span>
                      {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5', ...serialPlotLabelsRef.current.filter(l => !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].includes(l))].map((pin, i) => {
                        const isSel = selectedPlotPins.includes(pin);
                        const isAna = pin.startsWith('A');
                        const isLogic = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].includes(pin);
                        let bg = isAna ? 'rgba(52,152,219,0.2)' : 'rgba(46,204,113,0.2)';
                        let br = isAna ? '#3498db' : '#2ecc71';
                        if (!isLogic) {
                          const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                          const c = colors[i % colors.length];
                          bg = `${c}33`; br = c;
                        }
                        return (
                          <button
                            key={pin}
                            onClick={() => setSelectedPlotPins(prev => {
                              if (prev.includes(pin)) return prev.filter(p => p !== pin);
                              if (prev.length >= 8) return [...prev.slice(1), pin];
                              return [...prev, pin];
                            })}
                            style={{
                              background: isSel ? bg : 'transparent',
                              border: `1px solid ${isSel ? br : 'var(--border)'}`,
                              color: isSel ? br : 'var(--text3)',
                              borderRadius: 4, padding: '1px 5px', fontSize: 10, cursor: 'pointer'
                            }}
                          >{pin}</button>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    {selectedPlotPins.length > 0 && (
                      <div className="flex flex-wrap gap-y-1 gap-x-4 px-2.5 py-1 border-b border-[var(--border)] shrink-0">
                        {selectedPlotPins.map((pin, i) => {
                          let bg = pin.startsWith('A') ? '#3498db' : '#2ecc71';
                          let lbl = `Pin ${pin}`;
                          if (isNaN(parseInt(pin)) && !pin.startsWith('A')) {
                            const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6', '#e67e22', '#1abc9c'];
                            const serialVars = selectedPlotPins.filter(p => isNaN(parseInt(p)) && !p.startsWith('A'));
                            bg = colors[serialVars.indexOf(pin) % colors.length];
                            lbl = pin;
                          }
                          return (
                            <span key={pin} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, cursor: 'pointer' }}
                              onClick={() => setSelectedPlotPins(prev => prev.filter(p => p !== pin))}
                              title="Click to remove" >
                              <span style={{ width: 10, height: 10, borderRadius: 2, background: bg, flexShrink: 0 }} />
                              <span style={{ color: 'var(--text2)', fontFamily: 'JetBrains Mono, monospace' }}>{lbl}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Canvas */}
                    <div style={{ flex: 1, position: 'relative' }}>
                      {!isRunning && plotData.length === 0 ? (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', gap: 8, fontSize: 13 }}>
                          <span style={{ fontSize: 28 }}>📈</span>
                          Run simulator to trace signals.
                        </div>
                      ) : (
                        <canvas
                          ref={plotterCanvasRef}
                          width={800}
                          height={600}
                          style={{ position: 'absolute', width: '100%', height: '100%', background: '#070b14' }}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
  );
}


