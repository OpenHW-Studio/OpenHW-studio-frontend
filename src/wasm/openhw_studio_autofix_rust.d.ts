/* tslint:disable */
/* eslint-disable */

export function getAddedComponentId(fix_index: number, comp_index: number): string;

export function getAddedComponentType(fix_index: number, comp_index: number): string;

export function getAddedComponentX(fix_index: number, comp_index: number): number;

export function getAddedComponentY(fix_index: number, comp_index: number): number;

export function getAddedWireFrom(fix_index: number, wire_index: number): string;

export function getAddedWirePathPointCount(fix_index: number, wire_index: number): number;

export function getAddedWirePathPointX(fix_index: number, wire_index: number, point_index: number): number;

export function getAddedWirePathPointY(fix_index: number, wire_index: number, point_index: number): number;

export function getAddedWireTo(fix_index: number, wire_index: number): string;

export function getFixAddedComponentCount(index: number): number;

export function getFixAddedWireCount(index: number): number;

export function getFixDescription(index: number): string;

export function getFixPlanCount(): number;

export function getFixReasoningCount(index: number): number;

export function getFixReasoningStep(fix_index: number, step_index: number): string;

export function getFixRemovedWireCount(index: number): number;

export function getFixTargetRuleId(index: number): string;

export function getFixTransformationCount(index: number): number;

export function getRemovedWireFrom(fix_index: number, wire_index: number): string;

export function getRemovedWireTo(fix_index: number, wire_index: number): string;

export function getTransformationComponentId(fix_index: number, trans_index: number): string;

export function getTransformationRotation(fix_index: number, trans_index: number): number;

export function ingestComponent(id: string, kind: string, x: number, y: number, rotation: number): void;

export function ingestViolation(rule_id: string, message: string, component_ids_str: string, severity: string): void;

export function ingestWire(from: string, to: string, color: string): void;

export function reset(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly getAddedComponentId: (a: number, b: number) => [number, number];
    readonly getAddedComponentType: (a: number, b: number) => [number, number];
    readonly getAddedComponentX: (a: number, b: number) => number;
    readonly getAddedComponentY: (a: number, b: number) => number;
    readonly getAddedWireFrom: (a: number, b: number) => [number, number];
    readonly getAddedWirePathPointCount: (a: number, b: number) => number;
    readonly getAddedWirePathPointX: (a: number, b: number, c: number) => number;
    readonly getAddedWirePathPointY: (a: number, b: number, c: number) => number;
    readonly getAddedWireTo: (a: number, b: number) => [number, number];
    readonly getFixAddedComponentCount: (a: number) => number;
    readonly getFixAddedWireCount: (a: number) => number;
    readonly getFixDescription: (a: number) => [number, number];
    readonly getFixPlanCount: () => number;
    readonly getFixReasoningCount: (a: number) => number;
    readonly getFixReasoningStep: (a: number, b: number) => [number, number];
    readonly getFixRemovedWireCount: (a: number) => number;
    readonly getFixTargetRuleId: (a: number) => [number, number];
    readonly getFixTransformationCount: (a: number) => number;
    readonly getRemovedWireFrom: (a: number, b: number) => [number, number];
    readonly getRemovedWireTo: (a: number, b: number) => [number, number];
    readonly getTransformationComponentId: (a: number, b: number) => [number, number];
    readonly getTransformationRotation: (a: number, b: number) => number;
    readonly ingestComponent: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly ingestViolation: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly ingestWire: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly reset: () => void;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
