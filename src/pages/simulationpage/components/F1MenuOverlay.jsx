import React from 'react';
import { Btn } from '../Btn';

function F1MenuOverlayBase({
  showF1Menu,
  setShowF1Menu,
  downloadSimulationJson,
  openFirmwareDownloadDialog,
  openFirmwareUploadDialog,
  rp2040DebugTelemetryEnabled,
  setRp2040DebugTelemetryEnabled,
  componentTelemetryEnabled,
  setComponentTelemetryEnabled,
  deepSiliconDebuggingEnabled,
  setDeepSiliconDebuggingEnabled,
  telemetryMode = 'detail',
  setTelemetryMode,
  respectExitSide,
  setRespectExitSide,
  onOpenTelemetryModal,
  setShowSpeedDialog,
  simulationSpeed,
  setSimulationSpeed,
  isRunning,
  workerRef,
  handleStartGDB,
}) {
  if (!showF1Menu) return null;

  const closeMenu = () => setShowF1Menu(false);
  const resetSpeed = 1.0;

  const cycleTelemetryMode = () => {
    const modes = ['simple', 'detail', 'delta'];
    const nextIdx = (modes.indexOf(telemetryMode) + 1) % modes.length;
    const nextMode = modes[nextIdx];
    setTelemetryMode?.(nextMode);
    if (isRunning && workerRef?.current) {
      workerRef.current.postMessage({
        type: 'SET_COMPONENT_TELEMETRY',
        enabled: !!componentTelemetryEnabled,
        mode: nextMode,
        deepSilicon: deepSiliconDebuggingEnabled,
      });
    }
  };

  const toggleComponentTelemetry = () => {
    setComponentTelemetryEnabled?.((prev) => {
      const next = !prev;
      if (isRunning && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'SET_COMPONENT_TELEMETRY',
          enabled: next,
          mode: telemetryMode,
          deepSilicon: deepSiliconDebuggingEnabled,
        });
      }
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999] backdrop-blur-sm"
      onClick={closeMenu}
    >
      <div
        className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[420px] shadow-[0_16px_64px_rgba(0,0,0,.5)] flex flex-col max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold mb-5 text-[var(--text)] tracking-tight flex items-center justify-between pb-3 border-b border-[var(--border)]">
          <span>Quick Actions (F1)</span>
          <span className="text-xs bg-[var(--card)] px-2.5 py-1 rounded-full text-[var(--text2)] font-mono">v3.9</span>
        </div>
        <div className="flex flex-col gap-3">
          <Btn
            onClick={() => {
              downloadSimulationJson?.();
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Download Simulation JSON
          </Btn>
          <Btn
            onClick={() => {
              openFirmwareDownloadDialog?.();
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Download Firmware
          </Btn>
          <Btn
            onClick={() => {
              openFirmwareUploadDialog?.();
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Board Firmware Manager
          </Btn>

          <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider mt-2 mb-1 px-1">
            Component Telemetry & Diagnostics
          </div>

          <Btn
            onClick={toggleComponentTelemetry}
            style={{ width: '100%', justifyContent: 'space-between', padding: '12px 16px', background: componentTelemetryEnabled ? 'var(--card)' : 'var(--bg)' }}
            className={componentTelemetryEnabled ? 'border-[var(--accent)] text-[var(--accent)]' : ''}
          >
            <span>{componentTelemetryEnabled ? 'Disable Component Telemetry' : 'Enable Component Telemetry'}</span>
            <span className="text-xs font-bold font-mono">{componentTelemetryEnabled ? 'ON' : 'OFF'}</span>
          </Btn>

          <Btn
            onClick={() => {
              if (!componentTelemetryEnabled) return;
              setDeepSiliconDebuggingEnabled?.((prev) => {
                const next = !prev;
                if (isRunning && workerRef?.current) {
                  workerRef.current.postMessage({
                    type: 'SET_COMPONENT_TELEMETRY',
                    enabled: componentTelemetryEnabled,
                    mode: telemetryMode,
                    deepSilicon: next,
                  });
                }
                return next;
              });
            }}
            style={{ 
              width: '100%', 
              justifyContent: 'space-between', 
              padding: '12px 16px', 
              background: deepSiliconDebuggingEnabled ? 'var(--card)' : 'var(--bg)',
              opacity: componentTelemetryEnabled ? 1 : 0.5,
              cursor: componentTelemetryEnabled ? 'pointer' : 'not-allowed'
            }}
            className={deepSiliconDebuggingEnabled ? 'border-[var(--accent)] text-[var(--accent)]' : ''}
            disabled={!componentTelemetryEnabled}
          >
            <span>{deepSiliconDebuggingEnabled ? 'Disable Deep Silicon Debugging' : 'Enable Deep Silicon Debugging'}</span>
            <span className="text-xs font-bold font-mono">{deepSiliconDebuggingEnabled ? 'ON' : 'OFF'}</span>
          </Btn>

          <Btn
            onClick={() => {
              if (!componentTelemetryEnabled) return;
              onOpenTelemetryModal?.();
              setShowF1Menu?.(false);
            }}
            style={{ 
              width: '100%', 
              justifyContent: 'flex-start', 
              padding: '12px 16px', 
              background: 'var(--bg)',
              opacity: componentTelemetryEnabled ? 1 : 0.5,
              cursor: componentTelemetryEnabled ? 'pointer' : 'not-allowed'
            }}
            disabled={!componentTelemetryEnabled}
          >
            Select Telemetry Components
          </Btn>

          <div className="text-[10px] font-bold text-[var(--text3)] uppercase tracking-wider mt-2 mb-1 px-1">
            System & Emulation Controls
          </div>

          <Btn
            onClick={() => {
              setRespectExitSide?.((prev) => !prev);
            }}
            style={{ 
              width: '100%', 
              justifyContent: 'space-between', 
              padding: '12px 16px', 
              background: respectExitSide ? 'var(--card)' : 'var(--bg)'
            }}
            className={respectExitSide ? 'border-[var(--accent)] text-[var(--accent)]' : ''}
          >
            <span>Respect Pin Exit Sides</span>
            <span className="text-xs font-bold font-mono">{respectExitSide ? 'ON' : 'OFF'}</span>
          </Btn>

          <Btn
            onClick={() => {
              setRp2040DebugTelemetryEnabled?.((prev) => !prev);
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            {rp2040DebugTelemetryEnabled ? 'Disable RP2040 dbg Telemetry' : 'Enable RP2040 dbg Telemetry'}
          </Btn>
          <Btn
            onClick={() => {
              setShowSpeedDialog?.(true);
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Simulation Speed ({simulationSpeed.toFixed(1)}x)
          </Btn>
          <Btn
            onClick={() => {
              setSimulationSpeed?.(resetSpeed);
              if (isRunning && workerRef?.current) {
                workerRef.current.postMessage({ type: 'SET_SPEED', speed: resetSpeed });
              }
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Reset Simulation Speed (1.0x)
          </Btn>
          <Btn
            onClick={() => {
              handleStartGDB?.();
              closeMenu();
            }}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '12px 16px' }}
          >
            Start GDB Session
          </Btn>
        </div>
        <button
          className="mt-6 w-full px-3 py-2 text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors uppercase tracking-widest cursor-pointer"
          onClick={closeMenu}
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}

export const F1MenuOverlay = React.memo(F1MenuOverlayBase);