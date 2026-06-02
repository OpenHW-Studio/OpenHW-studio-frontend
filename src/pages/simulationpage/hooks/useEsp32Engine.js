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
  const hasAttachedSensorsRef = useRef(false);

  // MicroPython REPL refs
  const replStateRef = useRef('idle');
  const serialBufferRef = useRef('');
  const pendingMicroPythonCodeRef = useRef(null);
  const micropythonModeRef = useRef(false);

  // Webcam refs
  const webcamStreamRef = useRef(null);
  const webcamIntervalRef = useRef(null);
  const webcamVideoRef = useRef(null);
  const webcamCanvasRef = useRef(null);
  const webcamActiveRef = useRef(false);

  const esp32Socket = useHardwareSocket({
    onSerialLine: (text) => {
      serialFlushBufRef.current.push(text);
      if (micropythonModeRef.current) {
        handleMicroPythonReplSerial(text);
      }
    },
    onNeopixelSync: (channel, pixels) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'esp32:neopixel:sync',
          boardId: esp32Board.id,
          channel,
          pixels
        });
      }
    },
    onPwmSync: (channel, duty_pct) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'esp32:pwm:sync',
          boardId: esp32Board.id,
          channel,
          duty_pct
        });
      }
    },
    onSpiBatch: (b64) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'esp32:spi:batch',
          boardId: esp32Board.id,
          b64
        });
      }
    },
    onAdcSync: (channel, val) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'esp32:adc:sync',
          boardId: esp32Board.id,
          channel,
          val
        });
      }
    },
    onGpioSync: (pin, value) => {
      const pinId = String(pin);
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
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
    onTone: (pin, frequency, duration) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'TONE',
          boardId: esp32Board.id,
          pin,
          frequency,
          duration
        });
      }
    },
    onI2cTransaction: (addr, data) => {
      const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
      if (esp32Board && workerRef?.current) {
        workerRef.current.postMessage({
          type: 'esp32:i2c:transaction',
          boardId: esp32Board.id,
          addr,
          data
        });
      }
    },
    onLog: (msg, dir) => logSerial(msg, dir === 'err' ? 'var(--red, #f87171)' : undefined),
    onStop: () => {
      if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
      if (compileTimeoutRef.current) { clearTimeout(compileTimeoutRef.current); compileTimeoutRef.current = null; }
      esp32BuildIdRef.current = null;
      setIsRunning(false);
      setIsCompiling(false);
      setIsBooting(false); // Reset booting state on stop
      if (runStartGuardRef && runStartGuardRef.current !== undefined) {
          runStartGuardRef.current = false;
      }
      micropythonModeRef.current = false;
      replStateRef.current = 'idle';
      serialBufferRef.current = '';
      pendingMicroPythonCodeRef.current = null;
      stopWebcamStream();
    },
    onPhaseChange: (phase) => {
      if (phase === 'booting') {
        setIsBooting(true);
        setIsCompiling(false);
      } else if (phase === 'running') {
        setIsBooting(false);
        setIsCompiling(false);
        setIsRunning(true);
      } else if (phase === 'stopped' || phase === 'stalled') {
        setIsBooting(false);
      }
    }
  });

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
    const esp32Board = componentsRef.current?.find(c => /(esp32|stm32)/i.test(c.type));
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
      if (currComp && /(esp32|stm32)/i.test(currComp.type || '')) {
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

  // MicroPython REPL code sanitization
  const sanitizeForRepl = (codeText) => {
    let s = codeText.startsWith('\uFEFF') ? codeText.slice(1) : codeText;
    s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    s = s.replace(/^([ \t]*#.*)$/gm, (line) => line.replace(/[^\x00-\x7F]/g, '?'));
    s = s.replace(/([ \t]+#.*)$/gm, (comment) => comment.replace(/[^\x00-\x7F]/g, '?'));
    return s;
  };

  // Inject MicroPython code in 64-byte chunks
  const sendCodeInRawRepl = useCallback((codeText) => {
    const sanitized = sanitizeForRepl(codeText);
    const codeBytes = Array.from(new TextEncoder().encode(sanitized));
    logSerial(`[MicroPython] Uploading program (${codeBytes.length} bytes)...`);

    const CHUNK_SIZE = 64;
    const CHUNK_DELAY_MS = 150;
    let offset = 0;

    const sendChunk = () => {
      if (offset >= codeBytes.length) {
        setTimeout(() => {
          esp32Socket.sendSerialBytes?.([0x04]); // Ctrl+D → run
          replStateRef.current = 'idle';
          logSerial('[MicroPython] Code execution command (Ctrl+D) sent.');
        }, 300);
        return;
      }
      const chunk = codeBytes.slice(offset, offset + CHUNK_SIZE);
      esp32Socket.sendSerialBytes?.(chunk);
      offset += CHUNK_SIZE;
      setTimeout(sendChunk, CHUNK_DELAY_MS);
    };
    sendChunk();
  }, [esp32Socket, logSerial]);

  // MicroPython REPL 4-stage state machine handler
  const handleMicroPythonReplSerial = useCallback((text) => {
    if (!micropythonModeRef.current) return;

    if (pendingMicroPythonCodeRef.current || replStateRef.current !== 'idle') {
      serialBufferRef.current += text;

      // Stage 1: banner seen → send carriage return
      if (replStateRef.current === 'idle' && serialBufferRef.current.includes('Type "help()"')) {
        replStateRef.current = 'banner_seen';
        logSerial('[MicroPython] Stage 1: Banner detected → sending carriage return...');
        setTimeout(() => {
          esp32Socket.sendSerialBytes?.([0x0d]); // send CR
        }, 800);
      }

      // Stage 2: prompt seen → enter raw REPL via Ctrl+A
      if (replStateRef.current === 'banner_seen' && serialBufferRef.current.includes('>>>')) {
        replStateRef.current = 'prompt_seen';
        serialBufferRef.current = '';
        logSerial('[MicroPython] Stage 2: Python prompt (>>>) seen → entering raw REPL...');
        setTimeout(() => {
          esp32Socket.sendSerialBytes?.([0x01]); // Ctrl+A
        }, 200);
      }

      // Stage 3: raw REPL confirmed → send code bytes
      if (replStateRef.current === 'prompt_seen' && serialBufferRef.current.includes('raw REPL')) {
        replStateRef.current = 'raw_repl_entered';
        const codeText = pendingMicroPythonCodeRef.current;
        pendingMicroPythonCodeRef.current = null;
        serialBufferRef.current = '';
        logSerial('[MicroPython] Stage 3: Raw REPL confirmed → beginning chunked code injection...');
        setTimeout(() => {
          sendCodeInRawRepl(codeText);
        }, 200);
      }

      if (serialBufferRef.current.length > 8192) {
        serialBufferRef.current = serialBufferRef.current.slice(-1024);
      }
    }
  }, [esp32Socket, sendCodeInRawRepl, logSerial]);

  // Camera streaming methods
  const startWebcamStream = useCallback(async () => {
    webcamActiveRef.current = true;
    logSerial('📷 Requesting webcam permission for ESP32-CAM...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 320,
          height: 240,
          frameRate: { ideal: 10, max: 15 },
        },
        audio: false,
      });
      webcamStreamRef.current = stream;

      const video = document.createElement('video');
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      webcamVideoRef.current = video;

      try {
        await video.play();
      } catch (err) {
        // Handled silently
      }

      if (typeof OffscreenCanvas !== 'undefined') {
        webcamCanvasRef.current = new OffscreenCanvas(320, 240);
      } else {
        const c = document.createElement('canvas');
        c.width = 320;
        c.height = 240;
        webcamCanvasRef.current = c;
      }

      esp32Socket.sendCameraAttach?.();
      logSerial('📷 Webcam attached. Initiating 10 fps stream...');

      const MAX_FRAME_BYTES = 23000;
      const QUALITY_LADDER = [0.6, 0.5, 0.4, 0.3, 0.2, 0.1];
      const FALLBACK_W = 240;
      const FALLBACK_H = 180;

      webcamIntervalRef.current = window.setInterval(async () => {
        const v = webcamVideoRef.current;
        const c = webcamCanvasRef.current;
        if (!v || !c || v.readyState < 2) return;

        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(v, 0, 0, 320, 240);

        let encodedBlob = null;

        const canvasToBlob = (canvas, q) => {
          if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
            return canvas.convertToBlob({ type: 'image/jpeg', quality: q });
          }
          return new Promise(r => canvas.toBlob(r, 'image/jpeg', q));
        };

        for (const q of QUALITY_LADDER) {
          const blob = await canvasToBlob(c, q);
          if (blob && blob.size <= MAX_FRAME_BYTES) {
            encodedBlob = blob;
            break;
          }
        }

        if (!encodedBlob) {
          let smallCanvas;
          if (typeof OffscreenCanvas !== 'undefined') {
            smallCanvas = new OffscreenCanvas(FALLBACK_W, FALLBACK_H);
          } else {
            smallCanvas = document.createElement('canvas');
            smallCanvas.width = FALLBACK_W;
            smallCanvas.height = FALLBACK_H;
          }
          const sCtx = smallCanvas.getContext('2d');
          if (sCtx) {
            sCtx.drawImage(c, 0, 0, FALLBACK_W, FALLBACK_H);
          }
          const blob = await canvasToBlob(smallCanvas, 0.4);
          if (blob) {
            encodedBlob = blob;
          }
        }

        if (encodedBlob) {
          const buf = await encodedBlob.arrayBuffer();
          esp32Socket.sendCameraFrame?.(buf, 320, 240);
        }
      }, 100);

    } catch (err) {
      logSerial(`❌ Webcam acquisition failed: ${err.message || err}`);
      webcamActiveRef.current = false;
    }
  }, [esp32Socket, logSerial]);

  const stopWebcamStream = useCallback(() => {
    webcamActiveRef.current = false;
    if (webcamIntervalRef.current) {
      clearInterval(webcamIntervalRef.current);
      webcamIntervalRef.current = null;
    }
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }
    if (webcamVideoRef.current) {
      webcamVideoRef.current.srcObject = null;
      webcamVideoRef.current = null;
    }
    esp32Socket.sendCameraDetach?.();
    logSerial('📷 Webcam stream stopped and detached.');
  }, [esp32Socket, logSerial]);

  // Webcam auto start/stop controller
  useEffect(() => {
    const hasCamComponent = (componentsRef.current || components).some(c => c.type === 'openhw-esp32-cam' || c.type === 'esp32-cam');
    const esp32Board = (componentsRef.current || components).find(c => normalizeBoardKind(c.type) === 'esp32');
    const isCamBoard = esp32Board && esp32Board.type.includes('esp32-cam');
    const shouldRunWebcam = isRunning && (hasCamComponent || isCamBoard || esp32Board?.attrs?.cameraSource === 'webcam');

    if (shouldRunWebcam) {
      if (!webcamActiveRef.current) {
        startWebcamStream();
      }
    } else {
      if (webcamActiveRef.current) {
        stopWebcamStream();
      }
    }
  }, [isRunning, components, startWebcamStream, stopWebcamStream]);

  // Attach sensors securely once the simulation is fully running and WebSocket is open
  useEffect(() => {
    if (isRunning && esp32Socket && !hasAttachedSensorsRef.current) {
      hasAttachedSensorsRef.current = true;
      const i2cComps = (componentsRef.current || []).filter(c => /(ssd1306|pcf8574|mpu6050)/i.test(c.type || ''));
      i2cComps.forEach(comp => {
        let sensorType = 'ssd1306';
        if (comp.type.includes('pcf8574')) sensorType = 'pcf8574';
        if (comp.type.includes('mpu6050')) sensorType = 'mpu6050';
        const addr = parseInt(comp.attrs?.i2cAddress || comp.attrs?.address || (sensorType === 'ssd1306' ? '0x3C' : '0x27'), 16);
        if (esp32Socket.sensorAttach) {
            console.log(`[useEsp32Engine] Calling sensorAttach for ${sensorType} at address 0x${addr.toString(16)}`);
            esp32Socket.sensorAttach(sensorType, -1, { addr });
        }
      });
    }
  }, [isRunning, esp32Socket]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (webcamIntervalRef.current) clearInterval(webcamIntervalRef.current);
      if (webcamStreamRef.current) webcamStreamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const getEsp32Connections = useCallback((componentId) => {
    return [];
  }, []);

  const handleEsp32Interaction = useCallback((comp, event) => {
    return false; // Natively handled by Web Worker
  }, []);

  const startEsp32Session = useCallback(async (programmableBoards) => {
    const esp32Board = programmableBoards.find(c => normalizeBoardKind(c.type) === 'esp32');
    const stm32Board = programmableBoards.find(c => normalizeBoardKind(c.type) === 'stm32');
    if (esp32Board) {
      const isMicroPython = esp32Board.attrs?.env === 'micropython';

      if (serialFlushTimer.current) clearInterval(serialFlushTimer.current);
      serialFlushTimer.current = setInterval(flushESP32Serial, 120);

      // We reset the attach flag so the useEffect will attach sensors once the device finishes booting
      hasAttachedSensorsRef.current = false;

      if (isMicroPython) {
        logSerial('⚙️  Preparing ESP32 MicroPython firmware...');
        setIsBooting(true);
        setIsCompiling(false);
        
        try {
          const { getEsp32Firmware, padToFlashSize, uint8ArrayToBase64 } = await import('../../../esp32/utils/Esp32MicroPythonLoader.js');
          const rawFirmware = await getEsp32Firmware(esp32Board.type);
          const padded = padToFlashSize(rawFirmware, esp32Board.type);
          const b64 = uint8ArrayToBase64(padded);

          // Get the code
          const compileUnit = getBoardCompileFiles(esp32Board.id, '');
          let compileSource = useBlocklyCode ? blocklyGeneratedCode : (compileUnit.mainCode || getBoardMainCode(esp32Board.id) || code);
          if (compileSource === '{}') compileSource = code;

          // Prepare code injection
          pendingMicroPythonCodeRef.current = compileSource;
          micropythonModeRef.current = true;
          replStateRef.current = 'idle';
          serialBufferRef.current = '';

          // Launch session via runBinary
          const buildId = await esp32Socket.runBinary(b64);
          esp32BuildIdRef.current = buildId;
        } catch (esp32Err) {
          if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
          setIsRunning(false);
          setIsCompiling(false);
          setIsBooting(false);
          if (runStartGuardRef && runStartGuardRef.current !== undefined) {
              runStartGuardRef.current = false;
          }
          appendConsoleEntry('error', `ESP32 MicroPython load failed: ${esp32Err.message}`, 'simulator');
          alert(esp32Err.message);
        }
        return true; // Handled
      }

      logSerial('⚙️  Sending ESP32 firmware to QEMU server...');
      const compileUnit = getBoardCompileFiles(esp32Board.id, '');
      let compileSource = useBlocklyCode ? blocklyGeneratedCode : (compileUnit.mainCode || getBoardMainCode(esp32Board.id) || code);
      if (compileSource === '{}') compileSource = code;

      try {
        const buildId = await esp32Socket.run(compileSource);
        esp32BuildIdRef.current = buildId;
        setIsBooting(true);
        setIsCompiling(false);
      } catch (esp32Err) {
        if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
        setIsRunning(false);
        setIsCompiling(false);
        setIsBooting(false);
        if (runStartGuardRef && runStartGuardRef.current !== undefined) {
            runStartGuardRef.current = false;
        }
        appendConsoleEntry('error', `ESP32 compile failed: ${esp32Err.message}`, 'simulator');
        alert(esp32Err.message);
      }
      return true; // Handled
    } else if (stm32Board) {
      if (serialFlushTimer.current) clearInterval(serialFlushTimer.current);
      serialFlushTimer.current = setInterval(flushESP32Serial, 120);

      hasAttachedSensorsRef.current = false;

      logSerial('⚙️  Sending STM32 firmware to Renode compile server...');
      const compileUnit = getBoardCompileFiles(stm32Board.id, '');
      let compileSource = useBlocklyCode ? blocklyGeneratedCode : (compileUnit.mainCode || getBoardMainCode(stm32Board.id) || code);
      if (compileSource === '{}') compileSource = code;

      try {
        const buildId = await esp32Socket.run(compileSource, 'stm32');
        esp32BuildIdRef.current = buildId;
        setIsBooting(true);
        setIsCompiling(false);
      } catch (stm32Err) {
        if (serialFlushTimer.current) { clearInterval(serialFlushTimer.current); serialFlushTimer.current = null; }
        setIsRunning(false);
        setIsCompiling(false);
        setIsBooting(false);
        if (runStartGuardRef && runStartGuardRef.current !== undefined) {
            runStartGuardRef.current = false;
        }
        appendConsoleEntry('error', `STM32 compile failed: ${stm32Err.message}`, 'simulator');
        alert(stm32Err.message);
      }
      return true; // Handled
    }
    return false; // No ESP32 or STM32
  }, [getBoardCompileFiles, useBlocklyCode, blocklyGeneratedCode, getBoardMainCode, code, flushESP32Serial, esp32Socket, setIsCompiling, setIsRunning, runStartGuardRef, appendConsoleEntry, logSerial, setIsBooting]);

  const stopEsp32Session = useCallback(() => {
    esp32Socket.stop();
  }, [esp32Socket]);

  // Periodic Potentiometer and DHT-22 sync effect
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const comps = componentsRef.current || [];

      // ── 1. Potentiometers / Analog Sensors → ADC ─────────────────────────
      // Use setAdcValue (UART shim) which works in both legacy and shared-lib mode.
      const pots = comps.filter(c => /(potentiometer|slide.?pot|analog|ldr|light.?sensor|photoresist)/i.test(c.type || ''));
      pots.forEach(pot => {
        const connectedPin = traceConnectedEsp32Pin(pot.id, 'SIG')
          || traceConnectedEsp32Pin(pot.id, 'VOUT')
          || traceConnectedEsp32Pin(pot.id, 'OUT');
        if (connectedPin !== null) {
          const rawVal = pot.state?.value ?? pot.state?.resistance ?? 0;
          const maxVal = pot.attrs?.max ?? 1023;
          // Map to 12-bit ADC range (0-4095)
          const adcVal12 = Math.round((rawVal / maxVal) * 4095);
          // Send via UART shim (works in legacy mode)
          if (esp32Socket.setAdcValue) {
            esp32Socket.setAdcValue(connectedPin, adcVal12);
          } else {
            // Fallback: shared-lib path via millivolts
            const channelMap = { 32: 4, 33: 5, 34: 6, 35: 7, 36: 0, 39: 3 };
            const ch = channelMap[connectedPin];
            if (ch !== undefined) esp32Socket.sendAdc?.(ch, Math.round((adcVal12 / 4095) * 3300));
          }
        }
      });

      // ── 2. DHT-22 / DHT-11 → DHT UART sync ──────────────────────────────
      const dhts = comps.filter(c => /(dht22|dht11)/i.test(c.type || ''));
      dhts.forEach(dht => {
        const connectedPin = traceConnectedEsp32Pin(dht.id, 'SDA')
          || traceConnectedEsp32Pin(dht.id, 'DATA')
          || traceConnectedEsp32Pin(dht.id, 'SIG');
        if (connectedPin !== null) {
          const temp = Math.round(dht.state?.temperature ?? 24.0);
          const hum  = Math.round(dht.state?.humidity   ?? 40.0);
          esp32Socket.sendDht?.(connectedPin, temp, hum);
        }
      });

      // ── 3. I2C sensors → pre-seed I2C read-response bytes ────────────────
      // When firmware calls Wire.requestFrom(addr, n), the SimWire shim emits
      // >I2C_READ:addr:qty< and qemuRunner.js injects the cached response.
      // We re-seed every 250ms so the firmware always gets fresh readings.
      if (esp32Socket.setI2cResponse) {
        // MPU6050 (0x68 or 0x69) — accel/gyro/temp registers
        const mpus = comps.filter(c => /mpu6050/i.test(c.type || ''));
        mpus.forEach(mpu => {
          const addr = parseInt(mpu.attrs?.i2cAddress || '0x68', 16);
          const ax = Math.round((mpu.state?.accelX ?? 0.0) * 16384) & 0xFFFF;
          const ay = Math.round((mpu.state?.accelY ?? 0.0) * 16384) & 0xFFFF;
          const az = Math.round((mpu.state?.accelZ ?? 1.0) * 16384) & 0xFFFF;
          const gx = Math.round((mpu.state?.gyroX  ?? 0.0) * 131)   & 0xFFFF;
          const gy = Math.round((mpu.state?.gyroY  ?? 0.0) * 131)   & 0xFFFF;
          const gz = Math.round((mpu.state?.gyroZ  ?? 0.0) * 131)   & 0xFFFF;
          const tempRaw = Math.round((mpu.state?.temperature ?? 25.0) * 340 + 36053) & 0xFFFF;
          // MPU6050 burst read: ACCEL_XOUT_H..GYRO_ZOUT_L = 14 bytes
          const bytes = [
            (ax >> 8) & 0xFF, ax & 0xFF,
            (ay >> 8) & 0xFF, ay & 0xFF,
            (az >> 8) & 0xFF, az & 0xFF,
            (tempRaw >> 8) & 0xFF, tempRaw & 0xFF,
            (gx >> 8) & 0xFF, gx & 0xFF,
            (gy >> 8) & 0xFF, gy & 0xFF,
            (gz >> 8) & 0xFF, gz & 0xFF,
          ];
          esp32Socket.setI2cResponse(addr, bytes);
        });

        // BMP280 (0x76 or 0x77) — pressure + temp (simplified 6-byte raw read)
        const bmps = comps.filter(c => /bmp280|bme280/i.test(c.type || ''));
        bmps.forEach(bmp => {
          const addr = parseInt(bmp.attrs?.i2cAddress || '0x76', 16);
          const temp = bmp.state?.temperature ?? 25.0;
          const pres = bmp.state?.pressure    ?? 101325.0;
          // Encode as BMP280 raw 20-bit ADC values (MSB, LSB, XLSB)
          const tempAdc = Math.round((temp + 40) / 80 * 0xFFFFF) & 0xFFFFF;
          const presAdc = Math.round(pres / 1100 * 0xFFFFF) & 0xFFFFF;
          const bytes = [
            (presAdc >> 12) & 0xFF, (presAdc >> 4) & 0xFF, (presAdc << 4) & 0xF0,
            (tempAdc >> 12) & 0xFF, (tempAdc >> 4) & 0xFF, (tempAdc << 4) & 0xF0,
          ];
          esp32Socket.setI2cResponse(addr, bytes);
        });
      }
    }, 250); // Sync every 250ms

    return () => clearInterval(interval);
  }, [isRunning, traceConnectedEsp32Pin, esp32Socket]);

  return {
    handleEsp32Interaction,
    startEsp32Session,
    stopEsp32Session,
    esp32Socket
  };
}
