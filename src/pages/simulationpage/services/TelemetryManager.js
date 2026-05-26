import { useEffect, useRef, useCallback, useState } from 'react';
import { getTelemetryParamsForComponent } from '../utils/telemetryRegistry.js';

function extractParamValue(key, comp, telemetryData, state, activeMetrics, activeCustom) {
  let val = comp[key];
  if (val === undefined) val = state?.[key];
  if (val === undefined) val = telemetryData?.[key];
  if (val === undefined) val = telemetryData?.state?.[key];
  if (val === undefined) val = activeMetrics?.[key];
  if (val === undefined) val = telemetryData?.metrics?.[key];
  if (val === undefined) val = activeCustom?.[key];

  if (val === undefined && String(key).startsWith('deepSilicon')) {
    const deepObj = comp.deepSilicon || telemetryData?.deepSilicon;
    if (deepObj) {
      if (key === 'deepSiliconRegisters') val = deepObj.registers;
      else if (key === 'deepSiliconSRAM') val = deepObj.sramMap;
      else if (key === 'deepSiliconTimers') val = deepObj.timers;
      else if (key === 'deepSiliconPower') val = deepObj.power;
      else if (key === 'deepSiliconInterrupts') val = deepObj.interrupts;
    }
  }

  if (val === undefined) return 'N/A';

  if (typeof val === 'number') {
    if (key.toLowerCase().includes('voltage')) return `${val.toFixed(2)}V`;
    if (key.toLowerCase().includes('current')) return `${val.toFixed(2)}mA`;
    if (key.toLowerCase().includes('power')) return `${val.toFixed(2)}mW`;
    if (key.toLowerCase().includes('freq')) return `${val.toFixed(1)}Hz`;
    return val.toFixed(2);
  }
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'object') {
    try {
      if (val === null) return 'null';
      if (Array.isArray(val)) {
        return val.length > 8 ? `[Array(${val.length})]` : JSON.stringify(val);
      }
      const str = JSON.stringify(val);
      return str.length > 80 ? `{Object: ${Object.keys(val).length} keys}` : str;
    } catch (err) {
      console.error(`[Telemetry] Failed to stringify parameter ${key} for component ${comp?.id}:`, err);
      return '[Unserializable Object]';
    }
  }
  return String(val);
}

// Standalone formatting helper
export function formatTelemetryEntry(comp, mode, watchedParamsMap = {}) {
  const { id, type, state, delta, telemetrySummary, telemetryData } = comp;
  const activeMetrics = comp.metrics || comp._metrics || telemetryData?.metrics || telemetryData?._metrics || {};
  const activeHeuristics = comp.heuristics || comp._heuristics || telemetryData?.heuristics || telemetryData?._heuristics || { status: 'ok', summary: 'OK' };
  const activeCustom = comp.customTelemetry || comp.custom || telemetryData?.custom || telemetryData?.customTelemetry || {};

  const configuredParams = watchedParamsMap?.[id] || ['all'];
  let paramsToDisplay = configuredParams;
  if (configuredParams.includes('all')) {
    paramsToDisplay = getTelemetryParamsForComponent(type);
  } else {
    paramsToDisplay = configuredParams.filter(p => p !== 'all');
  }

  let paramStr = '';
  try {
    paramsToDisplay.forEach(p => {
      paramStr += ` | ${p}: ${extractParamValue(p, comp, telemetryData, state, activeMetrics, activeCustom)}`;
    });
  } catch (paramErr) {
    console.error(`[Telemetry] Error building parameter string for ${id} (${type}):`, paramErr, { paramsToDisplay, comp });
    paramStr += ' | [Error formatting parameters]';
  }

  const deepSilicon = comp.deepSilicon || telemetryData?.deepSilicon;

  if (mode === 'simple') {
    let baseSimple = telemetrySummary || 'State';
    if (baseSimple.includes('State:') || baseSimple.startsWith('OK:') || baseSimple.includes('No anomalies detected')) {
      baseSimple = 'State';
    }
    const details = state ? { ...state } : {};
    if (deepSilicon) details.deepSilicon = deepSilicon;
    return {
      id,
      type,
      summary: `${baseSimple}${paramStr}`,
      details,
      status: 'ok',
    };
  }

  if (mode === 'delta') {
    let baseDelta = delta ? (comp.deltaSummary || '[DELTA]') : '[STABLE]';
    if (baseDelta.includes('State/Metrics updated') || baseDelta.startsWith('OK:') || baseDelta.includes('No anomalies detected')) {
      baseDelta = '[DELTA]';
    }
    const details = telemetryData ? { ...telemetryData } : { state, metrics: activeMetrics, heuristics: activeHeuristics };
    if (deepSilicon) details.deepSilicon = deepSilicon;
    return {
      id,
      type,
      summary: `${baseDelta}${paramStr}`,
      details,
      status: activeHeuristics.status || 'ok',
    };
  }

  // Detail mode
  const rawFreq = activeMetrics.updateFreq !== undefined ? activeMetrics.updateFreq : activeMetrics.updateFreqHz;
  const freq = rawFreq !== undefined ? `${rawFreq}Hz` : 'N/A';
  const avgTiming = activeMetrics.timing?.avgMs !== undefined ? `${activeMetrics.timing.avgMs.toFixed(2)}ms` : (activeMetrics.idleMs !== undefined ? `idle:${activeMetrics.idleMs}ms` : 'N/A');
  const i2cTx = activeMetrics.ioThroughput?.i2cTransactions || 0;
  const spiTx = activeMetrics.ioThroughput?.spiTransactions || 0;

  let summaryStr = `Freq: ${freq} | Avg: ${avgTiming}`;
  if (i2cTx > 0 || spiTx > 0) {
    summaryStr += ` | I/O: I2C(${i2cTx}) SPI(${spiTx})`;
  }
  if (activeHeuristics.status && activeHeuristics.status !== 'ok') {
    summaryStr += ` | [${activeHeuristics.status.toUpperCase()}] ${activeHeuristics.summary}`;
  }
  summaryStr += paramStr;

  const details = telemetryData ? { ...telemetryData } : {
    state,
    metrics: activeMetrics,
    heuristics: activeHeuristics,
    custom: activeCustom,
  };
  if (deepSilicon) details.deepSilicon = deepSilicon;

  return {
    id,
    type,
    summary: summaryStr,
    details,
    status: activeHeuristics.status || 'ok',
  };
}

export function initGlobalTelemetry(managerInstance) {
  if (typeof window === 'undefined') return;
  window.OpenHWTelemetry = {
    getLatestTelemetry: () => managerInstance?.getLatestTelemetry?.() || [],
    setTelemetryEnabled: (enabled, mode) => managerInstance?.setTelemetryEnabled?.(enabled, mode),
    getSelectedComponents: () => managerInstance?.getSelectedComponents?.() || [],
    setSelectedComponents: (ids) => managerInstance?.setSelectedComponents?.(ids),
  };
}

export function useTelemetryManager({
  workerRef,
  appendConsoleEntry,
  simulationSpeed = 1.0,
  componentTelemetryEnabled,
  setComponentTelemetryEnabled,
  telemetryMode,
  setTelemetryMode,
  telemetrySampleInterval = 250,
  selectedTelemetryComponentIds,
  setSelectedTelemetryComponentIds,
  isBooting = false,
  isCompiling = false,
}) {
  const lastLogTimeRef = useRef(Date.now());
  const latestTelemetryCacheRef = useRef([]);
  const [telemetryWatchedParamsMap, setTelemetryWatchedParamsMap] = useState({});

  const handleTelemetryStateMessage = useCallback((msg) => {
    if (isBooting) return;
    if (!componentTelemetryEnabled || !msg || !Array.isArray(msg.components)) return;

    const safeSpeed = Number.isFinite(Number(simulationSpeed)) && Number(simulationSpeed) > 0 ? Number(simulationSpeed) : 1.0;
    const baseInterval = Number.isFinite(Number(telemetrySampleInterval)) ? Number(telemetrySampleInterval) : 250;
    const intervalMs = Math.max(50, baseInterval / safeSpeed);
    const now = Date.now();

    // In Delta mode, we must never throttle delta events, otherwise mutations occurring between sample intervals are permanently lost!
    if (telemetryMode !== 'delta' && now - lastLogTimeRef.current < intervalMs) return; 
    lastLogTimeRef.current = now;

    // Upstream O(1) filtering by selected component IDs
    const filterSet = Array.isArray(selectedTelemetryComponentIds)
      ? new Set(selectedTelemetryComponentIds)
      : new Set();

    const processed = [];
    msg.components.forEach((comp) => {
      if (!comp || !comp.id) return;
      if (!filterSet.has(comp.id)) return;

      const formatted = formatTelemetryEntry(comp, telemetryMode, telemetryWatchedParamsMap);
      processed.push(formatted);

      // Append to console
      if (appendConsoleEntry) {
        // In Delta mode, keep the visual console completely clean unless a delta occurred!
        if (telemetryMode === 'delta' && !comp.delta) return;

        const level = formatted.status === 'error' ? 'error' : formatted.status === 'warn' ? 'warn' : 'info';
        const logMsg = formatted.summary;
        appendConsoleEntry(level, logMsg, 'telemetry', formatted.details, formatted.id, formatted.type);
      }
    });

    latestTelemetryCacheRef.current = processed;
  }, [componentTelemetryEnabled, simulationSpeed, telemetrySampleInterval, selectedTelemetryComponentIds, telemetryMode, appendConsoleEntry, telemetryWatchedParamsMap, isBooting]);

  const setTelemetryEnabledCb = useCallback((enabled, modeOverride) => {
    const targetMode = modeOverride || telemetryMode || 'detail';
    setComponentTelemetryEnabled(!!enabled);
    if (modeOverride && setTelemetryMode) setTelemetryMode(targetMode);

    if (workerRef?.current) {
      const deepSilicon = typeof window !== 'undefined' ? localStorage.getItem('openhw.deepSiliconDebugging') === 'true' : false;
      const effectiveTelemetryEnabled = !!enabled && !isBooting && !isCompiling;
      
      workerRef.current.postMessage({
        type: 'SET_COMPONENT_TELEMETRY',
        enabled: effectiveTelemetryEnabled,
        mode: targetMode,
        watchedParamsMap: telemetryWatchedParamsMap,
        deepSilicon,
      });
    }
  }, [workerRef, telemetryMode, setComponentTelemetryEnabled, setTelemetryMode, telemetryWatchedParamsMap, isBooting, isCompiling]);

  useEffect(() => {
    if (workerRef?.current) {
      const deepSilicon = typeof window !== 'undefined' ? localStorage.getItem('openhw.deepSiliconDebugging') === 'true' : false;
      const effectiveTelemetryEnabled = componentTelemetryEnabled && !isBooting && !isCompiling;
      
      workerRef.current.postMessage({
        type: 'SET_COMPONENT_TELEMETRY',
        enabled: effectiveTelemetryEnabled,
        mode: telemetryMode,
        watchedParamsMap: telemetryWatchedParamsMap,
        deepSilicon,
      });
    }
  }, [workerRef, componentTelemetryEnabled, telemetryMode, telemetryWatchedParamsMap, isBooting, isCompiling]);

  const prevModeRef = useRef(telemetryMode);
  useEffect(() => {
    if (prevModeRef.current !== telemetryMode) {
      prevModeRef.current = telemetryMode;
      if (appendConsoleEntry) {
        appendConsoleEntry('info', `[Telemetry] Mode set to ${telemetryMode}`, 'telemetry', { mode: telemetryMode }, 'SYS', 'SYS');
      }
    }
  }, [telemetryMode, appendConsoleEntry]);

  const prevIntervalRef = useRef(telemetrySampleInterval);
  useEffect(() => {
    if (prevIntervalRef.current !== telemetrySampleInterval) {
      prevIntervalRef.current = telemetrySampleInterval;
      if (appendConsoleEntry) {
        appendConsoleEntry('info', `[Telemetry] Sample interval set to ${telemetrySampleInterval}ms`, 'telemetry', { interval: telemetrySampleInterval }, 'SYS', 'SYS');
      }
    }
  }, [telemetrySampleInterval, appendConsoleEntry]);

  const managerInstance = useRef({
    getLatestTelemetry: () => latestTelemetryCacheRef.current,
    setTelemetryEnabled: setTelemetryEnabledCb,
    getSelectedComponents: () => selectedTelemetryComponentIds,
    setSelectedComponents: setSelectedTelemetryComponentIds,
    getWatchedParamsMap: () => telemetryWatchedParamsMap,
    setWatchedParamsMap: setTelemetryWatchedParamsMap,
  }).current;

  // Update instance refs
  managerInstance.getLatestTelemetry = () => latestTelemetryCacheRef.current;
  managerInstance.setTelemetryEnabled = setTelemetryEnabledCb;
  managerInstance.getSelectedComponents = () => selectedTelemetryComponentIds;
  managerInstance.setSelectedComponents = setSelectedTelemetryComponentIds;
  managerInstance.getWatchedParamsMap = () => telemetryWatchedParamsMap;
  managerInstance.setWatchedParamsMap = setTelemetryWatchedParamsMap;

  useEffect(() => {
    initGlobalTelemetry(managerInstance);
  }, [managerInstance]);

  return {
    handleTelemetryStateMessage,
    setTelemetryEnabled: setTelemetryEnabledCb,
    getLatestTelemetry: () => latestTelemetryCacheRef.current,
    telemetryWatchedParamsMap,
    setTelemetryWatchedParamsMap,
  };
}
