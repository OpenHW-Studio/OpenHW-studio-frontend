// hal/types.ts — frozen-boundary type contracts (plan §5, §11).
//
// Types only: no runtime code, no behavior change. These interfaces name the
// direction the codebase converges toward (Board HAL v1, transport API,
// river envelope, telemetry schemas) so new code can implement against them
// while old code migrates incrementally. Additive; nothing imports this yet
// except future adopters.

// ── Board HAL v1 ─────────────────────────────────────────────────────
// Every board runner implements this boundary; engines stay private behind
// it. Mirrors the existing ArmEngineHooks shape plus the metadata runners
// currently sniff from board types (rail, pin list, limits).
export interface BoardHal {
    readonly boardId: string;
    readonly boardType: string;
    /** Logic rail volts for GPIO fan-out (3.3 CMOS vs 5V TTL). */
    railVoltage(): number;
    /** Canonical board pin list in manifest order. */
    pins(): string[];
    /** Alias expansion for one pin label (D13/13, GPIO/GP, PA9/A9, Ln/Pn…). */
    aliases(pin: string): string[];
    /** Capability codes claimed (see boards-registry.ts vocabulary). */
    capabilities(): string[];
    /** Engine limit codes (see boards-registry.ts). */
    limits(): string[];
    loadFirmware(image: string, boardType: string): Promise<void> | void;
    /** Advance the engine; returns executed steps/cycles. */
    step(budget: number): number;
    /** Engine-driven output level, or null/not-driving when floating. */
    sampleOutput(pin: string): { level: 0 | 1; driving: boolean } | null;
    /** Force an engine-side input level (buttons, sensors, pull-ups). */
    driveInput(pin: string, high: boolean): void;
    /** ADC channel in volts; null/NaN when unmodeled. */
    readAnalog(pin: string): number | null;
    /** Drain transmitted bytes since last tick. */
    uartDrain(): number[];
    /** Inject one received byte. */
    uartInject(byte: number, source?: string): void;
    programCounter(): number;
    halted(): boolean;
    reset(): void;
    close(): void;
}

// ── River envelope ───────────────────────────────────────────────────
// One addressing model for every lane (plan §11): signal, serial, protocol,
// telemetry, control, fault, blob. Lanes share the envelope; delivery
// policies differ per lane (latest-wins vs ordered vs sampled vs reliable).
export type RiverLane =
    | 'signal'
    | 'state'
    | 'serial'
    | 'protocol'
    | 'telemetry'
    | 'control'
    | 'fault'
    | 'blob';

export interface RiverEnvelope<T = unknown> {
    /** Schema version of the payload (additive evolution only). */
    schema: number;
    lane: RiverLane;
    boardId: string;
    componentId?: string;
    pin?: string;
    bus?: string;
    source?: string;
    /** Monotonic per-lane sequence; gaps mean counted loss, never silence. */
    seq: number;
    /** Simulated time when produced (ms); wall time only when sim has none. */
    simTimeMs: number;
    payload: T;
}

// ── Transport ────────────────────────────────────────────────────────
// Narrow boundary between simulation and threads (plan §5.4). SAB and
// message implementations share signatures; selection is capability-based
// (crossOriginIsolated), behavior identical, performance differs.
export interface SimTransport {
    readonly mode: 'sab' | 'message';
    publishPins(boardId: string, levels: Record<string, boolean>, analog?: Record<string, number>): void;
    publishSerial(boardId: string, bytes: number[], source: string): void;
    publishComponentSlots(frames: Array<{ id: string; slot: number; version: number; kind: number; f: number[]; i: number[] }>): void;
    publishTelemetryRecords(records: Array<{ slot: number; code: number; v0: number; v1: number; cycles: number }>): void;
    emitEvent(event: RiverEnvelope): void;
    drainCommands(max: number): RiverEnvelope[];
}

// ── Telemetry schemas ────────────────────────────────────────────────
// Versioned, additive. Unknown fields are ignored by older consumers;
// removed/renamed fields require a schema bump (plan §5.5).
export interface TelemetrySchema {
    schema: number;
    componentId: string;
    componentType: string;
    /** Compact numerics (SAB-slot compatible). */
    numerics: Record<string, number>;
    /** Rich context (message side-channel only, never the hot loop). */
    context?: Record<string, unknown>;
    /** Sampling policy that produced this record. */
    policy: 'change' | 'throttled' | 'decimated' | 'capture';
    /** Records this reader missed before this one (loss accounting). */
    skipped: number;
}
