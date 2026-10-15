// conformance-matrix.ts — generated board × component matrix (plan §5.6, §8).
//
// Builds every cell from data only: board families (boards-registry.ts) and
// component needs (getComponentCapabilities). No hand-maintained pair list,
// so a new board or component extends the matrix by existing, not by editing.
//
// Cell results:
// - supported:   every component need maps to a claimed board capability.
// - unsupported: at least one need is unmapped; reason names the missing
//                capabilities plus any board limit codes that explain it.
// - untested:    reserved for manual overrides (future hardware on the bench).
import { BOARD_FAMILIES, matchBoardFamily } from './boards-registry.ts';
import { getComponentCapabilities } from './registries/component-registry.ts';

// Component need → board capabilities that satisfy it.
const NEED_TO_BOARD_CAPS: Record<string, string[]> = {
  'digital-in': ['digital-gpio', 'digital-gpio-input', 'digital-gpio-sink'],
  'digital-out': ['digital-gpio'],
  'pwm-in': ['pwm'],
  'i2c-target': ['i2c-target'],
  'spi-target': ['spi-target'],
  'uart': ['uart', 'uart-console'],
  'onewire': ['onewire'],
  'analog-in': ['analog-adc'],
  'i2s': ['i2s'],
};

export type MatrixStatus = 'supported' | 'unsupported' | 'untested';

export interface MatrixCell {
  boardType: string;
  family: string;
  componentType: string;
  needs: string[];
  status: MatrixStatus;
  reason: string;
}

export interface MatrixOverrides {
  [key: string]: { status: MatrixStatus; reason: string }; // key: `${boardType}::${componentType}`
}

export function buildConformanceMatrix(
  boardTypes: string[],
  componentTypes: string[],
  overrides: MatrixOverrides = {},
): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const boardType of boardTypes) {
    const fam = matchBoardFamily(boardType);
    for (const componentType of componentTypes) {
      const key = `${boardType}::${componentType}`;
      const override = overrides[key];
      if (override) {
        cells.push({
          boardType, family: fam.family,
          componentType, needs: getComponentCapabilities(componentType),
          status: override.status, reason: override.reason,
        });
        continue;
      }
      const needs = getComponentCapabilities(componentType);
      const missing = needs.filter((need) => {
        const sats = NEED_TO_BOARD_CAPS[need] || [];
        return !sats.some((cap) => fam.capabilities.includes(cap));
      });
      if (!needs.length) {
        cells.push({
          boardType, family: fam.family, componentType, needs,
          status: 'untested', reason: 'component declares no capabilities',
        });
      } else if (missing.length === 0) {
        cells.push({
          boardType, family: fam.family, componentType, needs,
          status: 'supported', reason: `all needs mapped: ${needs.join(', ')}`,
        });
      } else {
        const limits = fam.limits.map((l) => l.code).join(', ');
        cells.push({
          boardType, family: fam.family, componentType, needs,
          status: 'unsupported',
          reason: `missing: ${missing.join(', ')}${limits ? `; limits: ${limits}` : ''}`,
        });
      }
    }
  }
  return cells;
}

/** Every known board family key, for full-matrix generation jobs. */
export function allBoardFamilies(): string[] {
  return BOARD_FAMILIES.map((f) => f.family);
}
