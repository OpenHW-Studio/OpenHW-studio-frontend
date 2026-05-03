export { applyCircuitFix, initializeCircuitFixEngine, getFixHistory, getFixValidator, getLastAppliedFix, undoLastFix, redoLastFix } from './circuit-fixer.js';
export { CircuitFixValidator } from './circuit-fix-validator.js';
export { CircuitFixHistory } from './circuit-fix-history.js';
export { fixPatternsCatalog, findApplicablePatterns, estimateFixComplexity } from './fix-patterns-catalog.js';
export {
  detectHighSpeedNets,
  estimateNetLength,
  findDifferentialPairs,
  flagDifferentialPairMismatches,
  recommendSeriesTermination,
  recommendTwistedPair,
} from './signal-integrity.js';

import { applyCircuitFix } from './circuit-fixer.js';
import {
  initializeCircuitFixEngine,
  getFixHistory,
  getFixValidator,
  undoLastFix,
  redoLastFix,
} from './circuit-fixer.js';
import { findApplicablePatterns } from './fix-patterns-catalog.js';
import {
  detectHighSpeedNets,
  recommendSeriesTermination,
  recommendTwistedPair,
} from './signal-integrity.js';

export function runAutoFix(project = {}, issue = {}, options = {}) {
  const engineConnections = (project.connections || []).map((wire) => ({
    from: String(wire.from || '').replace(':', '.'),
    to: String(wire.to || '').replace(':', '.'),
    color: wire.color,
    label: wire.label,
  }));

  const engineIssue = {
    message: issue.message || String(issue || ''),
    remediation: issue.remediation || issue.fix || null,
    compIds: issue.compIds || (issue.componentId ? [issue.componentId] : []),
    id: issue.ruleId || issue.id || null,
  };

  const result = applyCircuitFix(
    {
      components: project.components || [],
      connections: engineConnections,
    },
    engineIssue,
    {
      appliedBy: options.appliedBy || 'autofix-api',
      quiet: Boolean(options.quiet),
      verbose: Boolean(options.verbose),
      trackHistory: options.trackHistory !== false,
    }
  );

  const outConnections = (result.connections || []).map((wire) => ({
    from: String(wire.from || '').replace('.', ':'),
    to: String(wire.to || '').replace('.', ':'),
    color: wire.color,
    label: wire.label,
  }));

  return {
    applied: Boolean(result.applied),
    reason: result.reason || null,
    components: result.components || [],
    connections: outConnections,
    appliedFixes: result.appliedFixes || [],
    metadata: result.metadata || {},
  };
}

// Multi-issue planner: attempts fixes in a sandboxed, dry-run loop with verification
export async function runAutoFixAll(project = {}, issues = [], options = {}) {
  const minConfidence = Number(options.minConfidence ?? 0.5);
  const applyReal = Boolean(options.apply);
  const quiet = Boolean(options.quiet);

  // deep clone project to sandbox
  let sandbox = {
    components: JSON.parse(JSON.stringify(project.components || [])),
    connections: JSON.parse(JSON.stringify(project.connections || [])).map(w => ({ ...w })),
  };

  const appliedPlan = [];
  const skipped = [];

  // fetch validator instance (if initialized) and run initial validation
  const fixValidator = getFixValidator && typeof getFixValidator === 'function' ? getFixValidator() : null;
  let initialValidation = null;
  if (fixValidator && fixValidator.validator && typeof fixValidator.validator.runValidation === 'function') {
    try {
      initialValidation = await fixValidator.validator.runValidation(sandbox);
    } catch (e) {
      if (!quiet) console.warn('[runAutoFixAll] initial validation failed', e.message || e);
      initialValidation = { errors: [] };
    }
  } else {
    initialValidation = { errors: [] };
  }

  for (const issue of (issues || [])) {
    // try dry-run fix
    const dryResult = applyCircuitFix(
      { components: JSON.parse(JSON.stringify(sandbox.components)), connections: JSON.parse(JSON.stringify(sandbox.connections)) },
      issue,
      { dryRun: true, quiet: true, trackHistory: false, appliedBy: 'runAutoFixAll' }
    );

    if (!dryResult || !dryResult.applied) {
      skipped.push({ issue, reason: 'no-applicable-fix' });
      continue;
    }

    // verify using validator (if available)
    let verification = { verified: true, confidence: 1.0, newIssueCount: 0 };
    if (fixValidator) {
      try {
        verification = await fixValidator.verifyFix(issue, initialValidation, { components: dryResult.components, connections: dryResult.connections });
      } catch (e) {
        verification = { verified: false, confidence: 0.0, newIssueCount: 999, error: e.message };
      }
    }

    if (verification.verified && (verification.confidence >= minConfidence || verification.newIssueCount === 0)) {
      // accept into sandbox
      sandbox.components = JSON.parse(JSON.stringify(dryResult.components));
      sandbox.connections = JSON.parse(JSON.stringify(dryResult.connections));
      initialValidation = await (fixValidator && fixValidator.validator && fixValidator.validator.runValidation ? fixValidator.validator.runValidation(sandbox) : { errors: [] });

      appliedPlan.push({ issue, changeSet: dryResult.changeSet, verification });

      // if applyReal, apply to real project as well (sequential commit)
      if (applyReal) {
        applyCircuitFix(project, issue, { dryRun: false, quiet: true, appliedBy: 'runAutoFixAll', trackHistory: true });
      }
    } else {
      skipped.push({ issue, reason: 'verification-failed', verification });
    }
  }

  return {
    applied: appliedPlan.length > 0,
    appliedPlan,
    skipped,
    finalProject: sandbox,
    metadata: { appliedCount: appliedPlan.length, skippedCount: skipped.length },
  };
}

// Adapter for external use (webui, cli, mcp)
export function initializeAutofix(adapterOptions = {}) {
  // adapterOptions can include: persistence, logger, maxHistorySize
  return {
    runAutoFix,
    runAutoFixAll,
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
