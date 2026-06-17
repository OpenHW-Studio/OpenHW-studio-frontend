import { useCallback, useEffect, useMemo, useState } from 'react';
import { listHardwarePorts } from '../../services/simulatorService.js';

export function useHardwareFlashing({
  hardwareBoardId,
  boardComponents,
  resolveBoardHex,
  normalizeBoardKind,
  resolveBoardFqbn,
  boardFqbn,
  flashFirmware,
  pushSerialTxLine,
  pushSerialRxChunk,
  setHardwareStatus,
}) {
  const [hardwareAvailablePorts, setHardwareAvailablePorts] = useState([]);
  const [showAllHardwarePorts, setShowAllHardwarePorts] = useState(false);
  const [isLoadingHardwarePorts, setIsLoadingHardwarePorts] = useState(false);
  const [hardwareBaudRate, setHardwareBaudRate] = useState('9600');
  const [hardwareResetMethod, setHardwareResetMethod] = useState('normal');
  const [hardwarePortPath, setHardwarePortPath] = useState('');
  const [isUploadingHardware, setIsUploadingHardware] = useState(false);

  const resolvedHardwarePort = useMemo(() => {
    const manual = String(hardwarePortPath || '').trim();
    if (manual) return manual;
    return hardwareAvailablePorts[0]?.port || '';
  }, [hardwarePortPath, hardwareAvailablePorts]);

  const refreshHardwarePorts = useCallback(async () => {
    setIsLoadingHardwarePorts(true);
    try {
      const ports = await listHardwarePorts(showAllHardwarePorts);
      setHardwareAvailablePorts(ports);
      if (!String(hardwarePortPath || '').trim() && ports.length === 0) {
        setHardwareStatus('No serial ports detected. Enable Show all serial ports or connect device.');
      }
    } catch (err) {
      console.warn('[HardwarePorts] list failed:', err);
      setHardwareStatus(`Port scan failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsLoadingHardwarePorts(false);
    }
  }, [showAllHardwarePorts, hardwarePortPath, setHardwareStatus]);

  useEffect(() => {
    refreshHardwarePorts();
  }, [refreshHardwarePorts]);

  const uploadToHardware = useCallback(async (opts = {}) => {
    const { wasConnected, disconnectFn, connectFn } = opts;
    if (!hardwareBoardId) {
      alert('Please select a target board on canvas.');
      return;
    }

    const cleanPort = String(resolvedHardwarePort || '').trim();
    if (!cleanPort) {
      alert('No serial port detected. Connect your board, then refresh ports or enable Show all serial ports.');
      return;
    }

    // Ensure Web Serial is authorized NOW during the click event, so auto-reconnect works later
    if ('serial' in navigator && connectFn) {
      try {
        const ports = await navigator.serial.getPorts();
        if (ports.length === 0) {
          // No authorized ports. Prompt the user now while we are still in the user gesture context!
          await navigator.serial.requestPort();
        }
      } catch (e) {
        console.warn('Web Serial authorization prompt skipped or cancelled:', e);
        // We can still proceed with backend flash, but auto-reconnect will fail later.
      }
    }

    if (wasConnected && disconnectFn) {
      setHardwareStatus('Disconnecting serial monitor for upload...');
      await disconnectFn();
      setHardwareStatus('Waiting for port to be released...');
      await new Promise(r => setTimeout(r, 4000));
    }

    setIsUploadingHardware(true);
    try {
      const boardComp = boardComponents.find((b) => b.id === hardwareBoardId);
      if (!boardComp) throw new Error('Selected board is not available on canvas anymore.');

      setHardwareStatus('Resolving HEX for selected board...');
      const hexText = await resolveBoardHex(boardComp);

      const kind = normalizeBoardKind(boardComp.type);
      const fqbn = typeof resolveBoardFqbn === 'function'
        ? resolveBoardFqbn(boardComp, kind)
        : (boardFqbn[kind] || boardFqbn.arduino_uno);

      setHardwareStatus(`Flashing ${hardwareBoardId} via ${cleanPort}...`);
      const flashResult = await flashFirmware({
        port: cleanPort,
        fqbn,
        hex: hexText,
        baudRate: Number(hardwareBaudRate),
        resetMethod: hardwareResetMethod,
      });

      pushSerialTxLine(`Flashed ${hardwareBoardId} on ${cleanPort}`, hardwareBoardId, 'hw');
      if (flashResult?.output) {
        pushSerialRxChunk(`${flashResult.output}\n`, hardwareBoardId, 'hw');
      }
      setHardwareStatus(`Flash complete: ${hardwareBoardId} @ ${cleanPort}`);
      alert(`Code successfully uploaded to ${hardwareBoardId} on ${cleanPort}!`);
      
      if (connectFn) {
        setTimeout(async () => {
          try {
            await connectFn(true); // useLastPort = true
          } catch (e) {
            console.warn('[BootloaderFlash] Auto-reconnect failed', e);
          }
        }, 1200); // Give bootloader time to restart user application before reconnecting
      }
    } catch (err) {
      console.error('[BootloaderFlash] upload failed:', err);
      setHardwareStatus(`Flash failed: ${err?.message || 'Unknown error'}`);
      alert(err?.message || 'Hardware upload failed.');
    } finally {
      setIsUploadingHardware(false);
    }
  }, [
    hardwareBoardId,
    resolvedHardwarePort,
    boardComponents,
    resolveBoardHex,
    normalizeBoardKind,
    resolveBoardFqbn,
    boardFqbn,
    flashFirmware,
    hardwareBaudRate,
    hardwareResetMethod,
    pushSerialTxLine,
    pushSerialRxChunk,
    setHardwareStatus,
  ]);

  return {
    hardwareAvailablePorts,
    showAllHardwarePorts,
    setShowAllHardwarePorts,
    isLoadingHardwarePorts,
    hardwareBaudRate,
    setHardwareBaudRate,
    hardwareResetMethod,
    setHardwareResetMethod,
    hardwarePortPath,
    setHardwarePortPath,
    resolvedHardwarePort,
    refreshHardwarePorts,
    uploadToHardware,
    isUploadingHardware,
  };
}
