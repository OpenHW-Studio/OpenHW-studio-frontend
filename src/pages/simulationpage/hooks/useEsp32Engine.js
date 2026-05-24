import { useEffect, useRef, useCallback } from 'react';
import { useHardwareSocket } from '../../../esp32/hooks/useHardwareSocket.js';
import { normalizeBoardKind } from '../utils/hardwareUtils.js';

export function useEsp32Engine({
  components,
  wires,
  setOopStates,
  pinStates,
  setPinStates,
  pushSerialRxChunkRef,
  logSerial,
  setIsRunning,
  setIsCompiling,
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
      // [DEBUG_TELEMETRY] Log interpretation in the engine
      console.log(`[DEBUG_TELEMETRY] [useEsp32Engine] Applying pin state ${pinId} = ${value}, triggering OOP update...`);
      const esp32Board = componentsRef.current?.find(c => /esp32/i.test(c.type));
      if (esp32Board) {
        const boardState = getLiveOopStateSnapshot(esp32Board.id);
        const nextPins = { ...(boardState.pins || {}), [pinId]: value };
        const updates = [{ id: esp32Board.id, state: { ...boardState, pins: nextPins } }];

        // Breadth-First Search to find all transitively connected targets (handles vias & breadboards)
        const visited = new Set();
        const targetsMap = new Map();
        const queue = [
          `${esp32Board.id}:${pinId}`,
          `${esp32Board.id}:GPIO${pinId}`,
          `${esp32Board.id}:D${pinId}`
        ];

        queue.forEach(q => visited.add(q));

        while (queue.length > 0) {
          const current = queue.shift();
          const neighbors = pinToComponentsRef.current[current] || [];
          
          for (const neighbor of neighbors) {
            const nextKey = `${neighbor.compId}:${neighbor.pinId}`;
            if (!visited.has(nextKey)) {
              visited.add(nextKey);
              queue.push(nextKey);
              targetsMap.set(nextKey, neighbor);

              // Trace ACROSS pass-through components (resistors, vias, diodes)
              const comp = componentsRef.current?.find(c => c.id === neighbor.compId);
              const compType = comp?.type || '';
              if (comp && (compType.includes('resistor') || compType === 'via' || compType.includes('diode'))) {
                let otherPin = null;
                if (neighbor.pinId.endsWith('1')) otherPin = neighbor.pinId.replace(/1$/, '2');
                else if (neighbor.pinId.endsWith('2')) otherPin = neighbor.pinId.replace(/2$/, '1');
                else if (neighbor.pinId === 'A') otherPin = 'K';
                else if (neighbor.pinId === 'K') otherPin = 'A';
                
                if (otherPin) {
                  const crossKey = `${neighbor.compId}:${otherPin}`;
                  if (!visited.has(crossKey)) {
                    visited.add(crossKey);
                    queue.push(crossKey);
                  }
                }
              }
              
              // Breadboard internal routing heuristic (rows a-e, f-j)
              if (comp && compType.includes('breadboard')) {
                const rowMatch = neighbor.pinId.match(/^(\d+)([a-j])$/);
                if (rowMatch) {
                  const row = rowMatch[1];
                  const col = rowMatch[2];
                  const isTopHalf = 'abcde'.includes(col);
                  const group = isTopHalf ? ['a','b','c','d','e'] : ['f','g','h','i','j'];
                  group.forEach(c => {
                    if (c !== col) {
                      const crossKey = `${neighbor.compId}:${row}${c}`;
                      if (!visited.has(crossKey)) {
                        visited.add(crossKey);
                        queue.push(crossKey);
                      }
                    }
                  });
                }
              }
            }
          }
        }

        const targets = Array.from(targetsMap.values());

        if (targets.length > 0) {
          targets.forEach(t => {
            const comp = componentsRef.current.find(c => c.id === t.compId);
            const currentState = getLiveOopStateSnapshot(t.compId);
            const newPinStates = { ...(currentState.pinStates || {}), [t.pinId]: value };
            const extra = {};
            // wokwi-led lights up when anode pin A is HIGH
            if (comp?.type === 'wokwi-led' && t.pinId === 'A') {
              extra.illuminated = value === 1;
            }
            // Membrane Keypad Matrix scanning bridging
            if (comp?.type === 'wokwi-membrane-keypad' && t.pinId.startsWith('R')) {
              const pressedKey = currentState.pressedKey;
              if (pressedKey) {
                const matrix = {
                  '1': ['R1', 'C1'], '2': ['R1', 'C2'], '3': ['R1', 'C3'], 'A': ['R1', 'C4'],
                  '4': ['R2', 'C1'], '5': ['R2', 'C2'], '6': ['R2', 'C3'], 'B': ['R2', 'C4'],
                  '7': ['R3', 'C1'], '8': ['R3', 'C2'], '9': ['R3', 'C3'], 'C': ['R3', 'C4'],
                  '*': ['R4', 'C1'], '0': ['R4', 'C2'], '#': ['R4', 'C3'], 'D': ['R4', 'C4']
                };
                const pair = matrix[pressedKey];
                if (pair && pair[0] === t.pinId) {
                  const colPin = pair[1];
                  const colEspPin = traceConnectedEsp32Pin(t.compId, colPin);
                  if (colEspPin !== null) {
                    esp32Socket.sendGpio(colEspPin, value); // column pin mirrors row state!
                  }
                }
              }
            }
            updates.push({ id: t.compId, state: { ...currentState, pinStates: newPinStates, ...extra } });
          });
        }
        updateLiveOopStates(updates);
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
      if (runStartGuardRef && runStartGuardRef.current !== undefined) {
          runStartGuardRef.current = false;
      }
    },
  });

  const getEsp32Connections = useCallback((componentId) => {
    const connections = [];
    const compPins = new Set();
    for (const wire of wires || []) {
      if (wire.from.startsWith(`${componentId}:`)) {
        compPins.add(wire.from.split(':')[1]);
      }
      if (wire.to.startsWith(`${componentId}:`)) {
        compPins.add(wire.to.split(':')[1]);
      }
    }
    for (const pinName of compPins) {
      const espPin = traceConnectedEsp32Pin(componentId, pinName);
      if (espPin !== null) {
        connections.push({ compPin: pinName, esp32Pin: espPin });
      }
    }
    return connections;
  }, [wires, traceConnectedEsp32Pin]);

  const handleEsp32Interaction = useCallback((comp, event) => {
    if (!isRunning) return false;

    // Fast check: is there an esp32 in the project?
    const hasEsp32 = componentsRef.current.some(c => /esp32/i.test(c.type));
    if (!hasEsp32) return false;

    if (comp.type === 'wokwi-membrane-keypad') {
      if (event && event.startsWith && event.startsWith('press:')) {
        const key = event.split(':')[1];
        const currentState = getLiveOopStateSnapshot(comp.id);
        updateLiveOopStates([{ id: comp.id, state: { ...currentState, pressedKey: key } }]);
        
        const matrix = {
          '1': ['R1', 'C1'], '2': ['R1', 'C2'], '3': ['R1', 'C3'], 'A': ['R1', 'C4'],
          '4': ['R2', 'C1'], '5': ['R2', 'C2'], '6': ['R2', 'C3'], 'B': ['R2', 'C4'],
          '7': ['R3', 'C1'], '8': ['R3', 'C2'], '9': ['R3', 'C3'], 'C': ['R3', 'C4'],
          '*': ['R4', 'C1'], '0': ['R4', 'C2'], '#': ['R4', 'C3'], 'D': ['R4', 'C4']
        };
        const pair = matrix[key];
        if (pair) {
          const [rowPin, colPin] = pair;
          const rowEspPin = traceConnectedEsp32Pin(comp.id, rowPin);
          const colEspPin = traceConnectedEsp32Pin(comp.id, colPin);
          if (colEspPin !== null) {
            const isRowLow = rowEspPin !== null && pinStates[rowEspPin] === false;
            esp32Socket.sendGpio(colEspPin, isRowLow ? 0 : 1);
          }
        }
      } else if (event === 'release') {
        const currentState = getLiveOopStateSnapshot(comp.id);
        updateLiveOopStates([{ id: comp.id, state: { ...currentState, pressedKey: null } }]);
        
        ['C1', 'C2', 'C3', 'C4'].forEach(colPin => {
          const colEspPin = traceConnectedEsp32Pin(comp.id, colPin);
          if (colEspPin !== null) {
            esp32Socket.sendGpio(colEspPin, 1);
          }
        });
      }
      return true;
    }
    else if (comp.type === 'wokwi-pushbutton') {
      const conns = getEsp32Connections(comp.id);
      if (conns.length === 0) return false;
      const val = (event === 'press') ? 0 : 1;
      for (const conn of conns) {
        esp32Socket.sendGpio(conn.esp32Pin, val);
      }
      return true;
    }
    else if (comp.type === 'PIR-Motion-Sensor') {
      const conns = getEsp32Connections(comp.id);
      if (conns.length === 0) return false;
      const val = (event === 'motion_start') ? 1 : 0;
      for (const conn of conns) {
        esp32Socket.sendGpio(conn.esp32Pin, val);
      }
      return true;
    }
    else {
      const conns = getEsp32Connections(comp.id);
      if (conns.length > 0) {
        let digitalVal = null;
        if (typeof event === 'string') {
          const evt = event.toLowerCase();
          if (evt === 'press' || evt === 'motion_start' || evt === 'high' || evt === 'true' || evt.startsWith('press:')) {
            digitalVal = 1;
          } else if (evt === 'release' || evt === 'motion_stop' || evt === 'low' || evt === 'false') {
            digitalVal = 0;
          }
        } else if (event && typeof event === 'object') {
          if (event.value !== undefined) {
            if (typeof event.value === 'boolean') {
              digitalVal = event.value ? 1 : 0;
            } else {
              const num = Number(event.value);
              if (!isNaN(num)) {
                digitalVal = num > 50 ? 1 : 0;
              }
            }
          }
        }
        if (digitalVal !== null) {
          for (const conn of conns) {
            esp32Socket.sendGpio(conn.esp32Pin, digitalVal);
          }
          return true; // We handled it
        }
      }
    }
    return false; // Did not handle
  }, [isRunning, componentsRef, traceConnectedEsp32Pin, setOopStates, pinStates, esp32Socket, getEsp32Connections]);

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
        const buildId = await console.log('ESPSRC', JSON.stringify(compileSource)); esp32Socket.run(compileSource);
        esp32BuildIdRef.current = buildId;
        setIsCompiling(false);
      } catch (esp32Err) {
        if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
        setIsRunning(false);
        setIsCompiling(false);
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
