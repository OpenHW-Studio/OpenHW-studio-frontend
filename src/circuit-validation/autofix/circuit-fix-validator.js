/**
 * Circuit Fix Validator (moved to autofix/)
 * Verifies that applied fixes actually solve the problem without introducing new issues.
 */

export class CircuitFixValidator {
  constructor(validator) {
    this.validator = validator; // FullCircuitValidator instance
    this.fixHistory = [];
  }

  async verifyFix(error, beforeCircuit, afterCircuit, validationOptions = {}) {
    if (!this.validator) {
      return { verified: false, reason: 'No validator instance' };
    }

    const afterValidation = await this.validator.runValidation(afterCircuit, {
      ...validationOptions,
      profile: validationOptions.profile || 'balanced',
    });

    const afterErrors = afterValidation.errors || [];
    const beforeErrors = beforeCircuit.errors || [];

    const originalErrorId = error.id || error.ruleId;
    const errorStillExists = afterErrors.some(
      e => (e.id || e.ruleId) === originalErrorId
    );

    const newIssues = afterErrors.filter(
      newErr => !beforeErrors.some(
        oldErr => (oldErr.id || oldErr.ruleId) === (newErr.id || newErr.ruleId)
      )
    );

    const confidence = this.calculateFixConfidence(
      !errorStillExists,
      newIssues,
      error
    );

    const result = {
      verified: !errorStillExists,
      fixed: !errorStillExists,
      errorStillExists,
      newIssuesIntroduced: newIssues,
      newIssueCount: newIssues.length,
      confidence,
      summary: this.summarizeVerification(!errorStillExists, newIssues),
    };

    this.fixHistory.push({
      timestamp: Date.now(),
      error: originalErrorId,
      result,
    });

    return result;
  }

  calculateFixConfidence(fixed, newIssues = [], originalError = {}) {
    if (!fixed) return 0.0;

    let confidence = 1.0;

    if (newIssues.length > 0) {
      const errorCount = newIssues.filter(e => e.severity === 'error').length;
      const warnCount = newIssues.filter(e => e.severity === 'warn').length;
      const infoCount = newIssues.filter(e => e.severity === 'info').length;

      confidence -= errorCount * 0.25;
      confidence -= warnCount * 0.08;
      confidence -= infoCount * 0.02;
    }

    const remediation = String(originalError.remediation || '').toLowerCase();
    if (/add|wire|connect/i.test(remediation)) {
      confidence += 0.05;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  summarizeVerification(fixed, newIssues = []) {
    if (!fixed) {
      return '❌ Fix did not resolve the error. Try a different approach or check dependencies.';
    }

    if (newIssues.length === 0) {
      return '✅ Fix successful! No new issues introduced.';
    }

    const errors = newIssues.filter(e => e.severity === 'error').length;
    const warns = newIssues.filter(e => e.severity === 'warn').length;

    if (errors > 0) {
      return `⚠️ Fix resolved the original error, but introduced ${errors} new error(s). Review before applying.`;
    }

    if (warns > 0) {
      return `✅ Fix successful with ${warns} minor warning(s). Safe to apply.`;
    }

    return '✅ Fix successful!';
  }

  getVerificationHistory(errorId = null) {
    if (!errorId) {
      return this.fixHistory;
    }

    return this.fixHistory.filter(h => h.error === errorId);
  }

  wasFixSuccessful(errorId) {
    const history = this.getVerificationHistory(errorId);
    if (history.length === 0) return null;

    return history[history.length - 1].result.verified;
  }

  clearHistory() {
    this.fixHistory = [];
  }
}
