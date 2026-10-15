import { useCallback, useEffect, useRef } from "react";

export function getSerialTimestamp() {
  const now = new Date();
  return (
    now.toTimeString().slice(0, 8) +
    "." +
    String(now.getMilliseconds()).padStart(3, "0")
  );
}

const MAX_HISTORY = 2000;
const TRIM_TO = 1800;
const MAX_PAUSED_QUEUE = 1000;

/**
 * Serial-console ingress pipeline, extracted verbatim from SimulatorPage.jsx.
 *
 * Owns: plotter parse buffers, per-board ingress arbitration, pause queue,
 * pending-flush queue, and the setSerialHistory batching loop.
 *
 * NOTE on pushSerialRxChunkRef: the ref object is created by the CALLER
 * (SimulatorPage, above the hook call site) because useEsp32Engine() —
 * invoked earlier in the component — needs the stable ref identity. This
 * hook fills .current every render. Pass it in; do not create it here.
 *
 * Behavior contract (do not change without a Playwright serial test):
 * - !isRunning  -> setSerialHistory immediately (with rx-merge of open line)
 * - isRunning   -> queue into pendingSerialLogsRef, flushed every 100ms
 * - serialPaused -> park into paused queue (cap 1000), drained on unpause
 * - arbitration: one ingress source per board wins for a 240ms window
 *   (kills USB/UART mirrored duplicate bursts from RP2040 firmware)
 * - history capped at 2000 entries, trimmed to 1800
 *
 * @param {{ isRunning: boolean, serialPaused: boolean,
 *          setSerialHistory: Function, pushSerialRxChunkRef: Ref }} args
 */
export function useSerialIngress({ isRunning, serialPaused, setSerialHistory, pushSerialRxChunkRef }) {
  const serialPlotBufferRef = useRef("");
  const serialPlotLabelsRef = useRef([]);
  const latestParsedSerialRef = useRef([]);
  const serialIngressArbitrationRef = useRef(new Map());
  const serialPausedRef = useRef(false);
  const serialPausedQueueRef = useRef([]);
  const pendingSerialLogsRef = useRef([]);

  useEffect(() => {
    serialPausedRef.current = serialPaused;
  }, [serialPaused]);

  const parseSerialForPlotter = useCallback((chunk) => {
    serialPlotBufferRef.current += chunk;
    const lines = serialPlotBufferRef.current.split("\n");
    if (lines.length <= 1) return;

    const completeLines = lines.slice(0, -1);
    serialPlotBufferRef.current = lines[lines.length - 1];

    completeLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      // 1. Key:Value format (e.g., "Temperature:24.5" or "Temp: 24.5, Humidity: 60.0")
      if (trimmed.includes(":")) {
        const pairs = trimmed.split(/[,\t]+/).filter(Boolean);
        const parsedVars = {};
        let validPairCount = 0;

        pairs.forEach((pair) => {
          const colonIdx = pair.indexOf(":");
          if (colonIdx > 0) {
            const label = pair.slice(0, colonIdx).trim();
            const valStr = pair.slice(colonIdx + 1).trim();
            const val = parseFloat(valStr);
            if (label && /^[A-Za-z0-9_ -]+$/.test(label) && !isNaN(val)) {
              parsedVars[label] = val;
              validPairCount++;
            }
          }
        });

        if (validPairCount > 0) {
          const labels = Object.keys(parsedVars);
          labels.forEach((lbl) => {
            if (!serialPlotLabelsRef.current.includes(lbl)) {
              serialPlotLabelsRef.current.push(lbl);
            }
          });
          latestParsedSerialRef.current = Object.values(parsedVars);
          return;
        }
      }

      // 2. Purely numeric values (e.g. "24.5, 60.0" or "24.5 60.0")
      const parts = trimmed.split(/[,\s\t]+/).filter(Boolean);
      if (parts.length === 0) return;

      const isNumeric = parts.every((p) => !isNaN(parseFloat(p)));
      if (isNumeric) {
        latestParsedSerialRef.current = parts.map((p) => parseFloat(p));
        if (serialPlotLabelsRef.current.length < parts.length) {
          for (let i = serialPlotLabelsRef.current.length; i < parts.length; i++) {
            serialPlotLabelsRef.current.push(`SVar${i}`);
          }
        }
        return;
      }

      // 3. Potential Header Line (e.g. "Temperature, Humidity")
      // Ignore text lines if they contain sentence punctuation (!, ?, ., ;, etc.) or error log words
      const hasSentencePunctuation = /[!?.;"']/.test(trimmed);
      const isCleanHeader = parts.length <= 8 && parts.every((p) => /^[A-Za-z0-9_\-]+$/.test(p));
      const hasLogWords =
        /^(failed|error|warning|info|connecting|connected|initializing|setup|reading|booting)$/i.test(parts[0]);

      if (!hasSentencePunctuation && isCleanHeader && !hasLogWords) {
        serialPlotLabelsRef.current = parts;
      }
    });
  }, []);

  const appendSerialRxChunk = useCallback(
    (chunk, boardId = "default", source = "sim") => {
      const normalizedBoardId = String(boardId || "default");
      const normalizedSource = String(source || "sim");
      const nowMs = Date.now();
      const arbState = serialIngressArbitrationRef.current.get(normalizedBoardId) || {
        source: "",
        lastAcceptedAt: 0,
      };

      if (!arbState.source) {
        arbState.source = normalizedSource;
      } else if (arbState.source !== normalizedSource) {
        const recentlyAccepted = nowMs - Number(arbState.lastAcceptedAt || 0) <= 240;
        // Keep one ingress stream active per board for a short window to avoid
        // USB/UART mirrored duplicate output bursts from RP2040 firmware.
        if (recentlyAccepted) {
          return;
        }
        arbState.source = normalizedSource;
      }

      arbState.lastAcceptedAt = nowMs;
      serialIngressArbitrationRef.current.set(normalizedBoardId, arbState);

      parseSerialForPlotter(chunk);
      const ts = getSerialTimestamp();

      if (!isRunning) {
        // If simulation is not running (e.g. static debug output), update state immediately
        setSerialHistory((prev) => {
          let next = prev.length > MAX_HISTORY ? prev.slice(prev.length - TRIM_TO) : [...prev];
          if (next.length > 0) {
            const last = next[next.length - 1];
            if (
              last.dir === "rx" &&
              last.boardId === normalizedBoardId &&
              last.source === normalizedSource &&
              !last.text.endsWith("\n")
            ) {
              next[next.length - 1] = { ...last, text: last.text + chunk };
              return next;
            }
          }
          return [
            ...next,
            {
              dir: "rx",
              text: chunk,
              ts,
              boardId: normalizedBoardId,
              source: normalizedSource,
            },
          ];
        });
      } else {
        // Queue serial output chunks to batch-update state and prevent main-thread re-render choking
        pendingSerialLogsRef.current.push({
          chunk,
          boardId: normalizedBoardId,
          source: normalizedSource,
          ts,
        });
      }
    },
    [parseSerialForPlotter, isRunning, setSerialHistory],
  );

  const pushSerialRxChunk = useCallback(
    (chunk, boardId = "default", source = "sim") => {
      if (serialPausedRef.current) {
        const queue = serialPausedQueueRef.current;
        queue.push({ chunk, boardId, source });
        if (queue.length > MAX_PAUSED_QUEUE) {
          queue.splice(0, queue.length - MAX_PAUSED_QUEUE);
        }
        return;
      }
      appendSerialRxChunk(chunk, boardId, source);
    },
    [appendSerialRxChunk],
  );

  useEffect(() => {
    pushSerialRxChunkRef.current = pushSerialRxChunk;
  }, [pushSerialRxChunk]);

  useEffect(() => {
    if (serialPaused) return;
    const queue = serialPausedQueueRef.current;
    if (!queue.length) return;

    const pending = queue.splice(0, queue.length);
    pending.forEach((entry) => {
      appendSerialRxChunk(entry.chunk, entry.boardId, entry.source);
    });
  }, [serialPaused, appendSerialRxChunk]);

  const flushSerialLogs = useCallback(() => {
    const logsToFlush = pendingSerialLogsRef.current;
    if (logsToFlush.length === 0) return;
    pendingSerialLogsRef.current = [];

    setSerialHistory((prev) => {
      let next = prev.length > MAX_HISTORY ? prev.slice(prev.length - TRIM_TO) : [...prev];

      logsToFlush.forEach(({ chunk, boardId, source, ts }) => {
        if (next.length > 0) {
          const last = next[next.length - 1];
          if (
            last.dir === "rx" &&
            last.boardId === boardId &&
            last.source === source &&
            !last.text.endsWith("\n")
          ) {
            next[next.length - 1] = { ...last, text: last.text + chunk };
            return;
          }
        }
        next.push({
          dir: "rx",
          text: chunk,
          ts,
          boardId,
          source,
        });
      });

      if (next.length > MAX_HISTORY) {
        next = next.slice(next.length - TRIM_TO);
      }
      return next;
    });
  }, [setSerialHistory]);

  // Periodic flush loop to batch-update console logs every 100ms
  useEffect(() => {
    if (!isRunning) {
      if (pendingSerialLogsRef.current.length > 0) {
        flushSerialLogs();
      }
      return;
    }

    const interval = setInterval(() => {
      flushSerialLogs();
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, flushSerialLogs]);

  const pushSerialTxLine = useCallback(
    (text, boardId = "all", source = "sim") => {
      setSerialHistory((prev) => [
        ...prev,
        { dir: "tx", text, ts: getSerialTimestamp(), boardId, source },
      ]);
    },
    [setSerialHistory],
  );

  const clearSerialMonitor = useCallback(() => {
    setSerialHistory([]);
    serialPlotBufferRef.current = "";
    serialPlotLabelsRef.current = [];
    latestParsedSerialRef.current = [];
    serialIngressArbitrationRef.current.clear();
    serialPausedQueueRef.current = [];
  }, [setSerialHistory]);

  return {
    // shared mutable refs (also read by plotter + worker handlers in the page)
    serialPlotBufferRef,
    serialPlotLabelsRef,
    latestParsedSerialRef,
    serialIngressArbitrationRef,
    serialPausedRef,
    serialPausedQueueRef,
    pendingSerialLogsRef,
    pushSerialRxChunkRef,
    // pipeline API
    parseSerialForPlotter,
    appendSerialRxChunk,
    pushSerialRxChunk,
    flushSerialLogs,
    pushSerialTxLine,
    clearSerialMonitor,
  };
}
