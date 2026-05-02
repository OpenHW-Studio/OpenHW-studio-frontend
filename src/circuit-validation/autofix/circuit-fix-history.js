/**
 * Circuit Fix History & Undo/Redo Manager (moved to autofix/)
 */

export class CircuitFixHistory {
  constructor(maxHistorySize = 50) {
    this.history = [];
    this.currentIndex = -1;
    this.maxHistorySize = maxHistorySize;
  }

  recordFix(fix) {
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    const entry = {
      timestamp: Date.now(),
      id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      error: fix.error,
      errorId: fix.error?.id || fix.error?.ruleId,
      errorMessage: fix.error?.message,
      fixStrategy: fix.strategy,
      fixPatternId: fix.patternId,
      fixDescription: fix.description,
      circuitSnapshot: {
        before: JSON.parse(JSON.stringify(fix.circuitBefore)),
        after: JSON.parse(JSON.stringify(fix.circuitAfter)),
      },
      verification: fix.verification || null,
      appliedBy: fix.appliedBy || 'user',
      reversible: fix.reversible !== false,
      status: 'applied',
    };

    this.history.push(entry);
    this.currentIndex = this.history.length - 1;

    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.currentIndex--;
    }

    return entry;
  }

  getLastFix() {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex];
    }
    return null;
  }

  getFixById(fixId) {
    return this.history.find(f => f.id === fixId);
  }

  getFixesForError(errorId) {
    return this.history.filter(f => f.errorId === errorId);
  }

  getCurrentCircuit() {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex].circuitSnapshot.after;
    }
    return null;
  }

  getCircuitAtIndex(index) {
    if (index >= 0 && index < this.history.length) {
      return this.history[index].circuitSnapshot.after;
    }
    return null;
  }

  undo() {
    if (this.canUndo()) {
      const lastFix = this.history[this.currentIndex];
      lastFix.status = 'undone';
      this.currentIndex--;

      const circuitBefore = this.currentIndex >= 0
        ? this.history[this.currentIndex].circuitSnapshot.after
        : lastFix.circuitSnapshot.before;

      return {
        undone: true,
        fixId: lastFix.id,
        fixDescription: lastFix.fixDescription,
        circuit: circuitBefore,
      };
    }

    return { undone: false };
  }

  redo() {
    if (this.canRedo()) {
      this.currentIndex++;
      const nextFix = this.history[this.currentIndex];
      nextFix.status = 'applied';

      return {
        redone: true,
        fixId: nextFix.id,
        fixDescription: nextFix.fixDescription,
        circuit: nextFix.circuitSnapshot.after,
      };
    }

    return { redone: false };
  }

  canUndo() {
    return this.currentIndex >= 0;
  }

  canRedo() {
    return this.currentIndex < this.history.length - 1;
  }

  undoMultiple(count = 1) {
    const undone = [];
    for (let i = 0; i < count && this.canUndo(); i++) {
      const result = this.undo();
      undone.push(result);
    }
    return undone;
  }

  redoMultiple(count = 1) {
    const redone = [];
    for (let i = 0; i < count && this.canRedo(); i++) {
      const result = this.redo();
      redone.push(result);
    }
    return redone;
  }

  jumpToFix(fixId) {
    const index = this.history.findIndex(f => f.id === fixId);
    if (index >= 0) {
      this.currentIndex = index;
      return {
        jumped: true,
        fixId,
        circuit: this.history[index].circuitSnapshot.after,
      };
    }
    return { jumped: false };
  }

  getFixSummary() {
    return {
      totalFixes: this.history.length,
      currentPosition: this.currentIndex + 1,
      fixes: this.history.map((f, idx) => ({
        id: f.id,
        index: idx,
        timestamp: f.timestamp,
        errorMessage: f.errorMessage,
        fixDescription: f.fixDescription,
        status: f.status,
        reversible: f.reversible,
        verified: f.verification?.verified || false,
      })),
    };
  }

  exportAsJSON() {
    return JSON.stringify({
      timestamp: Date.now(),
      totalFixes: this.history.length,
      currentIndex: this.currentIndex,
      fixes: this.history.map(f => ({
        id: f.id,
        timestamp: f.timestamp,
        errorId: f.errorId,
        errorMessage: f.errorMessage,
        fixDescription: f.fixDescription,
        fixPatternId: f.fixPatternId,
        appliedBy: f.appliedBy,
        reversible: f.reversible,
        status: f.status,
        verification: f.verification,
      })),
    }, null, 2);
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
  }

  getTimeline() {
    return this.history.map((f, idx) => ({
      index: idx,
      id: f.id,
      timestamp: f.timestamp,
      description: f.fixDescription,
      isApplied: idx <= this.currentIndex,
      isCurrent: idx === this.currentIndex,
      verified: f.verification?.verified || false,
      errorCount: f.verification?.newIssueCount || 0,
    }));
  }

  revertToOriginal() {
    const originalCircuit = this.history.length > 0
      ? this.history[0].circuitSnapshot.before
      : null;

    this.currentIndex = -1;
    return originalCircuit;
  }
}
