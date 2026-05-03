import { useCallback, useEffect, useRef, useState } from 'react';

// Common USB vendors used by Arduino/ESP/STM/RP2040 USB-serial bridges.
const DEFAULT_SERIAL_USB_FILTERS = [
  { usbVendorId: 0x2341 }, // Arduino SA
  { usbVendorId: 0x2A03 }, // Arduino LLC
  { usbVendorId: 0x10C4 }, // Silicon Labs (CP210x)
  { usbVendorId: 0x0403 }, // FTDI
  { usbVendorId: 0x1A86 }, // QinHeng/WCH (CH340/CH910x)
  { usbVendorId: 0x303A }, // Espressif
  { usbVendorId: 0x2E8A }, // Raspberry Pi (RP2040)
  { usbVendorId: 0x0483 }, // STMicroelectronics
  { usbVendorId: 0x03EB }, // Microchip/Atmel
];

export function useWebSerialHardware({
  hardwareBoardId,
  hardwareSerialTargetRef,
  boardComponents,
  board,
  hardwareBaudRate,
  showAllHardwarePorts,
  normalizeBoardKind,
  boardDefaultBaud,
  pushSerialRxChunk,
  pushSerialTxLine,
  setHardwareStatus,
}) {
  const [hardwareConnected, setHardwareConnected] = useState(false);
  const [hardwareConnecting, setHardwareConnecting] = useState(false);

  const hardwarePortRef = useRef(null);
  const hardwareReaderRef = useRef(null);
  const hardwareReadAbortRef = useRef(false);
  const hardwareDecoderRef = useRef(new TextDecoder());

  const disconnectHardwareSerial = useCallback(async () => {
    hardwareReadAbortRef.current = true;

    try {
      if (hardwareReaderRef.current) {
        try { await hardwareReaderRef.current.cancel(); } catch { }
        try { hardwareReaderRef.current.releaseLock(); } catch { }
      }
    } finally {
      hardwareReaderRef.current = null;
    }

    try {
      if (hardwarePortRef.current) {
        try { await hardwarePortRef.current.close(); } catch { }
      }
    } finally {
      hardwarePortRef.current = null;
    }

    setHardwareConnected(false);
    setHardwareConnecting(false);
    setHardwareStatus('Disconnected');
  }, []);

  useEffect(() => {
    return () => {
      disconnectHardwareSerial();
    };
  }, [disconnectHardwareSerial]);

  const startHardwareReadLoop = useCallback(async (port, boardIdForLog) => {
    if (!port?.readable) return;
    const reader = port.readable.getReader();
    hardwareReaderRef.current = reader;
    hardwareReadAbortRef.current = false;

    try {
      while (!hardwareReadAbortRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (!value) continue;
        const decoded = hardwareDecoderRef.current.decode(value, { stream: true });
        if (decoded) pushSerialRxChunk(decoded, boardIdForLog || 'hardware', 'hw');
      }
    } catch (err) {
      if (!hardwareReadAbortRef.current) {
        console.warn('[WebSerial] Read loop failed:', err);
        setHardwareStatus('Serial connection lost');
      }
    } finally {
      try { reader.releaseLock(); } catch { }
      hardwareReaderRef.current = null;
      if (!hardwareReadAbortRef.current) {
        setHardwareConnected(false);
      }
    }
  }, [pushSerialRxChunk]);

  const connectHardwareSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert('Web Serial is not supported in this browser. Use Chromium-based browsers like Chrome or Edge.');
      return;
    }
    if (!hardwareBoardId) {
      alert('Please select a board before connecting hardware serial.');
      return;
    }

    setHardwareConnecting(true);
    setHardwareStatus('Waiting for serial device permission...');
    try {
      const boardComp = boardComponents.find((b) => b.id === hardwareBoardId);
      const kind = normalizeBoardKind(boardComp?.type || board);
      const baudRate = Number(hardwareBaudRate || boardDefaultBaud[kind] || boardDefaultBaud.arduino_uno);

      const requestOptions = showAllHardwarePorts
        ? {}
        : { filters: DEFAULT_SERIAL_USB_FILTERS };
      const port = await navigator.serial.requestPort(requestOptions);
      await port.open({ baudRate });
      hardwarePortRef.current = port;

      setHardwareConnected(true);
      setHardwareStatus(`Connected at ${baudRate} baud`);
      const targetId = hardwareSerialTargetRef?.current || hardwareBoardId || 'hardware';
      pushSerialTxLine(`Connected hardware serial on ${targetId} @ ${baudRate}`, targetId, 'hw');
      startHardwareReadLoop(port, targetId);
    } catch (err) {
      if (err?.name !== 'NotFoundError') {
        console.error('[WebSerial] connect failed:', err);
      }
      setHardwareStatus(err?.name === 'NotFoundError' ? 'Connection cancelled' : `Connection failed: ${err?.message || 'Unknown error'}`);
      setHardwareConnected(false);
    } finally {
      setHardwareConnecting(false);
    }
  }, [hardwareBoardId, hardwareSerialTargetRef, boardComponents, board, hardwareBaudRate, showAllHardwarePorts, normalizeBoardKind, boardDefaultBaud, pushSerialTxLine, startHardwareReadLoop]);

  const sendHardwareSerialLine = useCallback(async (text, targetBoard, previewText = null) => {
    if (!hardwareConnected || !hardwarePortRef.current?.writable) {
      throw new Error('Hardware serial is not connected.');
    }

    const payload = String(text ?? '');
    const writer = hardwarePortRef.current.writable.getWriter();
    try {
      await writer.write(new TextEncoder().encode(payload));
      const txLabel = previewText == null ? payload : String(previewText);
      pushSerialTxLine(txLabel, targetBoard || hardwareBoardId || 'hardware', 'hw');
    } finally {
      try { writer.releaseLock(); } catch { }
    }
  }, [hardwareConnected, hardwareBoardId, pushSerialTxLine]);

  return {
    hardwareConnected,
    hardwareConnecting,
    connectHardwareSerial,
    disconnectHardwareSerial,
    sendHardwareSerialLine,
  };
}
