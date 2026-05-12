/* tslint:disable */
/* eslint-disable */

export function findNearestBoard(x: number, y: number): string | undefined;

export function generateAutonomousSetup(new_comp_json: any, manifest_json: any, board_id: string, wires_json: any, allow_breadboard: boolean, is_rewire: boolean): any;

export function ingestComponent(id: string, kind: string, x: number, y: number, w: number, h: number, pins_json: any): void;

export function reset(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly findNearestBoard: (a: number, b: number) => [number, number];
    readonly generateAutonomousSetup: (a: any, b: any, c: number, d: number, e: any, f: number, g: number) => any;
    readonly ingestComponent: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: any) => void;
    readonly reset: () => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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
