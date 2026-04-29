import { FullCircuitValidator } from './engine.js';
export { FullCircuitValidator };

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
