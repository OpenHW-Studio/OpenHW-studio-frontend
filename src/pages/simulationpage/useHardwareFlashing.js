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

    if (wasConnected && disconnectFn) {
      setHardwareStatus('Disconnecting serial monitor for upload...');
      await disconnectFn();
      // Chrome on Windows takes a surprisingly long time to fully release
      // the exclusive OS-level lock on a COM port after port.close() resolves.
      // 2 seconds is NOT enough. 4 seconds reliably lets the driver release.
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
    } catch (err) {
      console.error('[BootloaderFlash] upload failed:', err);
      const backendDetails = err?.response?.data?.details || err?.response?.data?.error;
      const displayMsg = backendDetails ? `${err.message}\n\n${backendDetails}` : (err?.message || 'Unknown error');
      setHardwareStatus(`Flash failed: ${err?.message}`);
      alert(`Hardware upload failed:\n${displayMsg}`);
    } finally {
      setIsUploadingHardware(false);
      
      if (wasConnected && connectFn) {
        setTimeout(async () => {
          try {
            await connectFn(true); // useLastPort = true
          } catch (e) {
            console.warn('[BootloaderFlash] Auto-reconnect failed', e);
          }
        }, 1200); // Give bootloader time to restart user application before reconnecting
      }
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
