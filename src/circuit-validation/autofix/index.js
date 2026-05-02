export { applyCircuitFix, initializeCircuitFixEngine, getFixHistory, getFixValidator, getLastAppliedFix, undoLastFix, redoLastFix } from './circuit-fixer.js';
export { CircuitFixValidator } from './circuit-fix-validator.js';
export { CircuitFixHistory } from './circuit-fix-history.js';
export { fixPatternsCatalog, findApplicablePatterns, estimateFixComplexity } from './fix-patterns-catalog.js';
export { detectHighSpeedNets, recommendSeriesTermination, recommendTwistedPair } from './signal-integrity.js';

// Adapter for external use (webui, cli, mcp)
export function initializeAutofix(adapterOptions = {}) {
  // adapterOptions can include: persistence, logger, maxHistorySize
  return {
    applyCircuitFix,
    initializeCircuitFixEngine,
    getFixHistory,
    getFixValidator,
    undoLastFix,
    redoLastFix,
    findApplicablePatterns,
    detectHighSpeedNets,
    recommendSeriesTermination,
    recommendTwistedPair,
  };
}
