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

  return (
    <div
      className="fixed inset-0 bg-[rgba(0,0,0,.55)] flex items-center justify-center z-[9999]"
      onClick={closeMenu}
    >
      <div
        className="bg-[var(--bg2)] border border-[var(--border)] rounded-xl p-6 w-[420px] shadow-[0_8px_40px_rgba(0,0,0,.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-base font-bold mb-5 text-[var(--text)] tracking-tight">Quick Actions (F1)</div>
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
          className="mt-6 w-full px-3 py-2 text-xs font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors uppercase tracking-widest"
          onClick={closeMenu}
        >
          Close (Esc)
        </button>
      </div>
    </div>
  );
}

export const F1MenuOverlay = React.memo(F1MenuOverlayBase);