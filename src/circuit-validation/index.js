export { FullCircuitValidator } from './engine.js';
export { analyzeCodeHardwareSync } from './sync-analyzer.js';
export { applyCircuitFix, initializeCircuitFixEngine, getFixHistory, getFixValidator, getLastAppliedFix, undoLastFix, redoLastFix } from './circuit-fixer.js';
export { CircuitFixValidator } from './circuit-fix-validator.js';
export { CircuitFixHistory } from './circuit-fix-history.js';
export { fixPatternsCatalog, findApplicablePatterns, estimateFixComplexity } from './fix-patterns-catalog.js';
export { ProtocolAnalyzer } from './protocol-analyzer.js';
export { detectHighSpeedNets, recommendSeriesTermination, recommendTwistedPair } from './autofix/signal-integrity.js';

// The Integration "Glue" Code (likely sitting in a React component or Redux thunk)
export const handleCompileAndRun = (projectState, startCompilationPipeline, handleValidationFailure) => {

    // 1. Instantiate the modular engine
    const validator = new FullCircuitValidator(projectState);

    // 2. Run the Physics/Wiring Checks
    const isCircuitSafe = validator.runValidation();

    if (!isCircuitSafe) {
        if (handleValidationFailure) handleValidationFailure(validator.errors);
        return; // HALT EXECUTION
    }

    // 3. If safe, proceed to compilation
    if (startCompilationPipeline) startCompilationPipeline(projectState.code);
};
