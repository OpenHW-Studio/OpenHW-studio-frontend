import { useEffect, useRef, useCallback } from 'react';
import { useHardwareSocket } from '../../../esp32/hooks/useHardwareSocket.js';
import { normalizeBoardKind } from '../utils/hardwareUtils.js';

export function useEsp32Engine({
  workerRef,
  components,
  wires,
  setOopStates,
  pinStates,
  setPinStates,
  pushSerialRxChunkRef,
  logSerial,
  setIsRunning,
  setIsCompiling,
  setIsBooting, // TODO: Added parameter for booting state tracking
  runStartGuardRef,
  appendConsoleEntry,
  getBoardCompileFiles,
  getBoardMainCode,
  code,
  useBlocklyCode,
  blocklyGeneratedCode,
  isRunning,
  getLiveOopStateSnapshot,
  updateLiveOopStates
}) {
  const esp32BuildIdRef = useRef(null);
  const serialFlushBufRef = useRef([]);
  const serialFlushTimer = useRef(null);
  const compileTimeoutRef = useRef(null);
  const pinToComponentsRef = useRef({});
  const componentsRef = useRef(components);

  useEffect(() => {
    componentsRef.current = components;
  }, [components]);

  // Rebuild pin→component connectivity map whenever wires change
  useEffect(() => {
    const map = {};
    wires.forEach(w => {
      const from = (w.from || '').split(':');
      const to = (w.to || '').split(':');
      if (from.length === 2 && to.length === 2) {
        if (!map[`${from[0]}:${from[1]}`]) map[`${from[0]}:${from[1]}`] = [];
        map[`${from[0]}:${from[1]}`].push({ compId: to[0], pinId: to[1] });
        if (!map[`${to[0]}:${to[1]}`]) map[`${to[0]}:${to[1]}`] = [];
        map[`${to[0]}:${to[1]}`].push({ compId: from[0], pinId: from[1] });
      }
    });
    pinToComponentsRef.current = map;
  }, [wires]);

  // Flush batched ESP32 serial text every 120 ms to avoid per-char setState
  const flushESP32Serial = useCallback(() => {
    const lines = serialFlushBufRef.current.splice(0);
    if (!lines.length) return;
    const esp32Board = componentsRef.current?.find(c => /esp32/i.test(c.type));
    const boardId = esp32Board ? esp32Board.id : 'esp32';
    if (pushSerialRxChunkRef.current) {
      lines.forEach(line => pushSerialRxChunkRef.current(line, boardId, 'sim'));
    }
  }, [pushSerialRxChunkRef]);

  // Helper to trace wires from a component pin to a connected ESP32 pin
  const traceConnectedEsp32Pin = useCallback((componentId, componentPinName) => {
    const visited = new Set();
    const queue = [`${componentId}:${componentPinName}`];
    visited.add(`${componentId}:${componentPinName}`);

    while (queue.length > 0) {
      const current = queue.shift();
      const [currCompId, currPin] = current.split(':');

      const currComp = (componentsRef.current || components).find(c => c.id === currCompId);
      if (currComp && /esp32/i.test(currComp.type || '')) {
        const pinNum = parseInt(currPin.replace(/\D/g, ''), 10);
        if (!isNaN(pinNum)) {
          return pinNum;
        }
      }

      for (const wire of wires || []) {
        if (wire.from === current && !visited.has(wire.to)) {
          visited.add(wire.to);
          queue.push(wire.to);
        } else if (wire.to === current && !visited.has(wire.from)) {
          visited.add(wire.from);
          queue.push(wire.from);
        }
      }
    }
    return null;
  }, [components, wires]);

  const esp32Socket = useHardwareSocket({
    onSerialLine: (text) => { serialFlushBufRef.current.push(text); },
    onGpioSync: (pin, value) => {
      const pinId = String(pin);
      const esp32Board = componentsRef.current?.find(c => /esp32/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'GPIO_SYNC',
          boardId: esp32Board.id,
          pin: pinId,
          value: value
        });
      }
      setPinStates(prev => ({ ...prev, [pinId]: value === 1 }));
    },
    onLog: (msg, dir) => logSerial(msg, dir === 'err' ? 'var(--red, #f87171)' : undefined),
    onStop: () => {
      if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
      if (compileTimeoutRef.current) { clearTimeout(compileTimeoutRef.current); compileTimeoutRef.current = null; }
      esp32BuildIdRef.current = null;
      setIsRunning(false);
      setIsCompiling(false);
      setIsBooting(false); // TODO: Reset booting state on stop
      if (runStartGuardRef && runStartGuardRef.current !== undefined) {
          runStartGuardRef.current = false;
      }
    },
    onPhaseChange: (phase) => {
      // TODO: Handle simulator booting / compiling / running phase transitions for ESP32
      if (phase === 'booting') {
        setIsBooting(true);
        setIsCompiling(false);
      } else if (phase === 'running') {
        setIsBooting(false);
        setIsCompiling(false);
        setIsRunning(true); // Establishes running state now that QEMU is live
      } else if (phase === 'stopped' || phase === 'stalled') {
        setIsBooting(false);
      }
    },
  });

  const getEsp32Connections = useCallback((componentId) => {
    return [];
  }, []);

  const handleEsp32Interaction = useCallback((comp, event) => {
    return false; // Natively handled by Web Worker
  }, []);

  const startEsp32Session = useCallback(async (programmableBoards) => {
    const esp32Board = programmableBoards.find(c => normalizeBoardKind(c.type) === 'esp32');
    if (esp32Board) {
      logSerial('⚙️  Sending ESP32 firmware to QEMU server...');
      const compileUnit = getBoardCompileFiles(esp32Board.id, '');
      let compileSource = useBlocklyCode ? blocklyGeneratedCode : (compileUnit.mainCode || getBoardMainCode(esp32Board.id) || code);
      if (compileSource === '{}') compileSource = code;

      if (serialFlushTimer.current) clearInterval(serialFlushTimer.current);
      serialFlushTimer.current = setInterval(flushESP32Serial, 120);

      try {
        const buildId = await esp32Socket.run(compileSource);
        esp32BuildIdRef.current = buildId;
        setIsBooting(true); // Transition immediately to booting status once compile finishes
        setIsCompiling(false);
        // TODO: Do not set isCompiling to false here; let the onPhaseChange WebSocket handler set isCompiling / isBooting appropriately as the backend boots up.
      } catch (esp32Err) {
        if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
        setIsRunning(false);
        setIsCompiling(false);
        setIsBooting(false); // TODO: Reset booting state on error
        if (runStartGuardRef && runStartGuardRef.current !== undefined) {
            runStartGuardRef.current = false;
        }
        appendConsoleEntry('error', `ESP32 compile failed: ${esp32Err.message}`, 'simulator');
        alert(esp32Err.message);
      }
      return true; // Handled
    }
    return false; // No ESP32
  }, [getBoardCompileFiles, useBlocklyCode, blocklyGeneratedCode, getBoardMainCode, code, flushESP32Serial, esp32Socket, setIsCompiling, setIsRunning, runStartGuardRef, appendConsoleEntry, logSerial]);

  const stopEsp32Session = useCallback(() => {
    esp32Socket.stop();
  }, [esp32Socket]);

  return {
    handleEsp32Interaction,
    startEsp32Session,
    stopEsp32Session,
    esp32Socket // Export in case it's needed elsewhere
  };
}
