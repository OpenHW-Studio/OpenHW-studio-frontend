type TelemetrySeverity = 'ok' | 'warn' | 'error';

type TelemetryHeuristicResult = {
    status: TelemetrySeverity;
    summary: string;
    findings: string[];
};

type TelemetryManifestConfig = {
    template?: string;
    criticalKeys?: string[];
};

export class BaseComponent {
    id: string;
    type: string;
    pins: { [key: string]: { voltage: number, mode: string } };
    state: any;
    stateChanged: boolean;
    telemetryEnabled: boolean = false;

    private telemetryManifest: TelemetryManifestConfig | null = null;
    private telemetryRuntime = {
        createdAtMs: Date.now(),
        updateCount: 0,
        firstCpuCycles: null as number | null,
        lastCpuCycles: null as number | null,
        stateMutationCount: 0,
        lastStateChangeAtMs: Date.now(),
        lastStateChangeCycles: null as number | null,
        onEventCount: 0,
        onPinStateChangeCount: 0,
        interactionsByType: {} as Record<string, number>,
        pinToggles: {} as Record<string, number>,
        pinLogicLevels: {} as Record<string, boolean>,
        io: {
            i2cTransactions: 0,
            i2cBytes: 0,
            spiTransactions: 0,
            spiBytes: 0,
            uartBytes: 0,
            recentI2c: [] as number[],
            recentSpi: [] as number[],
        },
        power: {
            vccCurrent: 0,
            vccAverage: 0,
            vccSamples: 0,
            gndCurrent: 0,
            gndAverage: 0,
            gndSamples: 0,
        },
        lastEventAtMs: 0,
        lastIoAtMs: 0,
        stateFingerprint: '',
        lastStateFingerprintAtMs: 0,
        updateStartAtMs: 0,
        updateStartPerfMs: 0,
        lastUpdateAtMs: 0,
        totalUpdateTimeMs: 0,
        maxUpdateTimeMs: 0,
        customTelemetry: {} as Record<string, any>,
        lastHeuristicStatus: null as TelemetryHeuristicResult | null,
    };

    private lastReportedJson: string = '';
    onTelemetryFinding?: (finding: { summary: string; severity: 'warn' | 'error' }) => void;

    constructor(id: string, manifest: any) {
        this.id = id;
        this.type = manifest.type;
        this.pins = {};

        // Initialize pins from manifest
        if (manifest.pins) {
            manifest.pins.forEach((pinSpec: any) => {
                this.pins[pinSpec.id] = {
                    voltage: 0,
                    mode: 'INPUT',
                };
            });
        }

        this.state = {};
        this.stateChanged = true;

        const telemetry = manifest?.telemetry;
        if (telemetry && typeof telemetry === 'object' && !Array.isArray(telemetry)) {
            this.telemetryManifest = {
                template: typeof telemetry.template === 'string' ? telemetry.template : undefined,
                criticalKeys: Array.isArray(telemetry.criticalKeys)
                    ? telemetry.criticalKeys.map((k: any) => String(k || '').trim()).filter(Boolean)
                    : [],
            };
        }

        this.installTelemetryHooks();
        this.observeStateMutation('constructor', undefined, true);
    }

    private wrapTelemetryMethod(
        methodName: string,
        before?: (...args: any[]) => void,
        after?: (result: any, ...args: any[]) => void
    ): void {
        const host = this as any;
        const current = host[methodName];
        if (typeof current !== 'function') return;
        if (current.__telemetryWrapped) return;

        const wrapped = (...args: any[]) => {
            if (this.telemetryEnabled && before) {
                try {
                    before(...args);
                } catch {
                    // Non-fatal telemetry hook.
                }
            }

            const result = current.apply(this, args);

            if (this.telemetryEnabled && after) {
                try {
                    after(result, ...args);
                } catch {
                    // Non-fatal telemetry hook.
                }
            }
            return result;
        };

        wrapped.__telemetryWrapped = true;
        wrapped.__telemetryOriginal = current;
        host[methodName] = wrapped;
    }

    private installTelemetryHooks(): void {
        this.wrapTelemetryMethod(
            'update',
            (cpuCycles: number) => {
                const startMs = Date.now();
                const startPerfMs = this.getPerfNowMs();
                this.telemetryRuntime.updateCount += 1;
                this.telemetryRuntime.updateStartAtMs = startMs;
                this.telemetryRuntime.updateStartPerfMs = startPerfMs;
                this.captureCpuCycles(cpuCycles);
            },
            (_result, cpuCycles: number) => {
                const endMs = Date.now();
                const startMs = Number(this.telemetryRuntime.updateStartAtMs || 0);
                const endPerfMs = this.getPerfNowMs();
                const startPerfMs = Number(this.telemetryRuntime.updateStartPerfMs || 0);
                if (startMs > 0 || startPerfMs > 0) {
                    const duration = Math.max(
                        0,
                        startPerfMs > 0 ? (endPerfMs - startPerfMs) : (endMs - startMs)
                    );
                    this.telemetryRuntime.totalUpdateTimeMs += duration;
                    if (duration > this.telemetryRuntime.maxUpdateTimeMs) {
                        this.telemetryRuntime.maxUpdateTimeMs = duration;
                    }
                }
                this.telemetryRuntime.lastUpdateAtMs = endMs;
                this.observeStateMutation('update', cpuCycles, false);
            }
        );

        this.wrapTelemetryMethod(
            'onEvent',
            (event: any) => {
                this.telemetryRuntime.onEventCount += 1;
                this.telemetryRuntime.lastEventAtMs = Date.now();
                const key = this.getInteractionKey(event);
                this.telemetryRuntime.interactionsByType[key] =
                    Number(this.telemetryRuntime.interactionsByType[key] || 0) + 1;
            },
            () => {
                this.observeStateMutation('onEvent', undefined, true);
            }
        );

        this.wrapTelemetryMethod(
            'onPinStateChange',
            (pinId: string, isHigh: boolean, cpuCycles: number) => {
                this.telemetryRuntime.onPinStateChangeCount += 1;
                this.captureCpuCycles(cpuCycles);
                this.capturePinLogicLevel(pinId, !!isHigh);
            },
            (_result, _pinId: string, _isHigh: boolean, cpuCycles: number) => {
                this.observeStateMutation('onPinStateChange', cpuCycles, false);
            }
        );

        this.wrapTelemetryMethod('onI2CStart', () => {
            this.telemetryRuntime.io.i2cTransactions += 1;
            this.telemetryRuntime.lastIoAtMs = Date.now();
        });

        this.wrapTelemetryMethod(
            'onI2CByte',
            () => {
                this.telemetryRuntime.io.i2cBytes += 1;
                this.telemetryRuntime.lastIoAtMs = Date.now();
            },
            () => {
                this.observeStateMutation('onI2CByte', undefined, false);
            }
        );

        this.wrapTelemetryMethod('onI2CStop', () => {
            this.telemetryRuntime.lastIoAtMs = Date.now();
        });

        this.wrapTelemetryMethod(
            'onSPIByte',
            () => {
                this.telemetryRuntime.io.spiBytes += 1;
                this.telemetryRuntime.io.spiTransactions += 1;
                this.telemetryRuntime.lastIoAtMs = Date.now();
            },
            () => {
                this.observeStateMutation('onSPIByte', undefined, false);
            }
        );

        const protocolHooks = [
            'onPWM',
            'onPwm',
            'onPWMSignal',
            'onPIOPinChange',
            'onPioPinChange',
            'onPIO',
            'onPio',
            'onOneWireReset',
            'onOnewireReset',
            'onOneWireWriteBit',
            'onOnewireWriteBit',
            'onOneWireSlot',
            'onOnewireSlot',
            'onI2SFrame',
        ];

        for (const hook of protocolHooks) {
            this.wrapTelemetryMethod(
                hook,
                () => {
                    this.telemetryRuntime.lastIoAtMs = Date.now();
                },
                () => {
                    this.observeStateMutation(hook, undefined, false);
                }
            );
        }
    }

    recordI2cTransaction(data: number[]) {
        if (!this.telemetryEnabled) return;
        this.telemetryRuntime.io.i2cTransactions++;
        this.telemetryRuntime.io.i2cBytes += data.length;
        this.telemetryRuntime.lastIoAtMs = Date.now();
        this.telemetryRuntime.io.recentI2c = data.slice(-16);
    }

    recordSpiTransaction(data: number[]) {
        if (!this.telemetryEnabled) return;
        this.telemetryRuntime.io.spiTransactions++;
        this.telemetryRuntime.io.spiBytes += data.length;
        this.telemetryRuntime.lastIoAtMs = Date.now();
        this.telemetryRuntime.io.recentSpi = data.slice(-16);
    }

    private getInteractionKey(event: any): string {
        if (typeof event === 'string') return event.trim() || 'string';
        if (!event || typeof event !== 'object') return 'unknown';
        const maybeType = String((event as any).type || '').trim();
        if (maybeType) return maybeType;
        const keys = Object.keys(event);
        return keys.length ? `object:${keys.sort().join(',')}` : 'object';
    }

    private captureCpuCycles(cpuCycles: number): void {
        const cycles = Number(cpuCycles);
        if (!Number.isFinite(cycles) || cycles < 0) return;

        if (this.telemetryRuntime.firstCpuCycles === null || cycles < this.telemetryRuntime.firstCpuCycles) {
            this.telemetryRuntime.firstCpuCycles = cycles;
        }

        if (this.telemetryRuntime.lastCpuCycles === null || cycles >= this.telemetryRuntime.lastCpuCycles) {
            this.telemetryRuntime.lastCpuCycles = cycles;
            return;
        }

        // Handle CPU resets where cycle counters go backwards.
        this.telemetryRuntime.firstCpuCycles = cycles;
        this.telemetryRuntime.lastCpuCycles = cycles;
    }

    private capturePinLogicLevel(pinId: string, isHigh: boolean): void {
        const key = String(pinId || '').trim();
        if (!key) return;

        const prev = this.telemetryRuntime.pinLogicLevels[key];
        this.telemetryRuntime.pinLogicLevels[key] = !!isHigh;

        if (prev === undefined) return;
        if (prev === !!isHigh) return;

        this.telemetryRuntime.pinToggles[key] = Number(this.telemetryRuntime.pinToggles[key] || 0) + 1;
    }

    private getPerfNowMs(): number {
        try {
            const perf = (globalThis as any).performance;
            if (perf && typeof perf.now === 'function') {
                return Number(perf.now());
            }
        } catch {
            // Fallback to wall-clock below.
        }
        return Date.now();
    }

    private isVccLikePin(pinId: string): boolean {
        return /^(vcc|vin|vdd|3v3|5v|pwr)/i.test(String(pinId || '').trim());
    }

    private isGndLikePin(pinId: string): boolean {
        return /^(gnd|vss|0v|ground)/i.test(String(pinId || '').trim());
    }

    private updateRunningAverage(current: number, average: number, samples: number): { average: number; samples: number } {
        const nextSamples = samples + 1;
        const nextAverage = average + ((current - average) / nextSamples);
        return { average: nextAverage, samples: nextSamples };
    }

    private capturePowerSample(pinId: string, voltage: number): void {
        const value = Number(voltage);
        if (!Number.isFinite(value)) return;

        if (this.isVccLikePin(pinId)) {
            this.telemetryRuntime.power.vccCurrent = value;
            const avg = this.updateRunningAverage(
                value,
                this.telemetryRuntime.power.vccAverage,
                this.telemetryRuntime.power.vccSamples
            );
            this.telemetryRuntime.power.vccAverage = avg.average;
            this.telemetryRuntime.power.vccSamples = avg.samples;
            return;
        }

        if (this.isGndLikePin(pinId)) {
            this.telemetryRuntime.power.gndCurrent = value;
            const avg = this.updateRunningAverage(
                value,
                this.telemetryRuntime.power.gndAverage,
                this.telemetryRuntime.power.gndSamples
            );
            this.telemetryRuntime.power.gndAverage = avg.average;
            this.telemetryRuntime.power.gndSamples = avg.samples;
        }
    }

    private normalizeStateForTelemetry(value: any, depth = 0): any {
        if (value === null || value === undefined) return value;

        if (typeof value === 'string') {
            return value.length > 4096 ? `${value.slice(0, 4096)}...` : value;
        }

        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }

        if (ArrayBuffer.isView(value)) {
            const view = value as ArrayLike<number> & { length?: number };
            const len = Number(view?.length || 0);
            const preview: number[] = [];
            for (let i = 0; i < Math.min(len, 24); i += 1) {
                preview.push(Number(view[i] || 0));
            }
            return {
                kind: 'typed-array',
                length: len,
                preview,
            };
        }

        if (Array.isArray(value)) {
            if (value.length <= 24 && depth <= 1) {
                return value.map((entry) => this.normalizeStateForTelemetry(entry, depth + 1));
            }
            return {
                kind: 'array',
                length: value.length,
                preview: value.slice(0, 24).map((entry) => this.normalizeStateForTelemetry(entry, depth + 1)),
            };
        }

        if (typeof value === 'object') {
            const keys = Object.keys(value);
            if (depth >= 3 && keys.length > 16) {
                return {
                    kind: 'object',
                    keys: keys.slice(0, 16),
                    size: keys.length,
                };
            }

            const out: Record<string, any> = {};
            for (const key of keys.sort((a, b) => a.localeCompare(b))) {
                out[key] = this.normalizeStateForTelemetry(value[key], depth + 1);
            }
            return out;
        }

        return String(value);
    }

    private safeSerializeState(): string {
        try {
            return JSON.stringify(this.normalizeStateForTelemetry(this.state));
        } catch {
            return '{}';
        }
    }

    private observeStateMutation(source: string, cpuCycles?: number, force = false): void {
        const now = Date.now();
        const minIntervalMs = source === 'update' ? 45 : 0;
        if (!force && minIntervalMs > 0 && (now - this.telemetryRuntime.lastStateFingerprintAtMs) < minIntervalMs) {
            return;
        }

        this.telemetryRuntime.lastStateFingerprintAtMs = now;
        const fingerprint = this.safeSerializeState();

        if (!this.telemetryRuntime.stateFingerprint) {
            this.telemetryRuntime.stateFingerprint = fingerprint;
            this.telemetryRuntime.lastStateChangeAtMs = now;
            if (Number.isFinite(Number(cpuCycles))) {
                this.telemetryRuntime.lastStateChangeCycles = Number(cpuCycles);
            }
            return;
        }

        if (fingerprint === this.telemetryRuntime.stateFingerprint) {
            return;
        }

        this.telemetryRuntime.stateFingerprint = fingerprint;
        this.telemetryRuntime.stateMutationCount += 1;
        this.telemetryRuntime.lastStateChangeAtMs = now;
        if (Number.isFinite(Number(cpuCycles))) {
            this.telemetryRuntime.lastStateChangeCycles = Number(cpuCycles);
        }
        this.stateChanged = true;
    }

    setPinVoltage(pinId: string, voltage: number) {
        if (this.pins[pinId] && this.pins[pinId].voltage !== voltage) {
            this.pins[pinId].voltage = voltage;
            this.capturePinLogicLevel(pinId, Number(voltage) > 0.5);
            this.capturePowerSample(pinId, Number(voltage));
            this.stateChanged = true;
        }
    }

    getPinVoltage(pinId: string): number {
        return this.pins[pinId] ? this.pins[pinId].voltage : 0.0;
    }

    update(cpuCycles: number, currentWires: any[], allComponentsInstances: BaseComponent[]) {
        // Override in subclasses
    }

    onEvent(event: any) {
        // Override in subclasses to handle UI interactions
    }

    onPinStateChange(pinId: string, isHigh: boolean, cpuCycles: number) {
        // Override in subclasses
    }

    onI2CStart?(address: number, read: boolean): boolean;
    onI2CByte?(address: number, data: number): boolean;
    onI2CStop?(): void;

    onSPIByte?(data: number): number | void;

    onPWM?(pinId: string, payload: any): void;
    onPwm?(pinId: string, payload: any): void;
    onPWMSignal?(pinId: string, payload: any): void;

    onPIOPinChange?(pinId: string, isHigh: boolean, payload: any): void;
    onPioPinChange?(pinId: string, isHigh: boolean, payload: any): void;
    onPIO?(pinId: string, isHigh: boolean, payload: any): void;
    onPio?(pinId: string, isHigh: boolean, payload: any): void;

    onOneWireReset?(pinId: string, payload: any): void;
    onOnewireReset?(pinId: string, payload: any): void;
    onOneWireWriteBit?(pinId: string, bit: number, payload: any): void;
    onOnewireWriteBit?(pinId: string, bit: number, payload: any): void;
    onOneWireSlot?(pinId: string, payload: any): void;
    onOnewireSlot?(pinId: string, payload: any): void;

    /**
     * Called by the I2S bit-bang assembler in execute.ts once a full audio
     * frame (bitsPerFrame bits) has been clocked in on one channel.
     *
     * @param channel  0 = left  (WS LOW),  1 = right (WS HIGH)
     * @param sample   Signed 16-bit PCM value shifted into an unsigned number
     *                 (high bitsPerFrame bits of a 32-bit word when bitsPerFrame < 32)
     * @param bitsPerFrame  Number of BCLK cycles per frame (default 16)
     *
     * Component implementations should declare their preferred bit depth via
     * a manifest attr `i2sBitsPerFrame`. The assembler in execute.ts will
     * honour that value; it defaults to 16.
     */
    onI2SFrame?(channel: number, sample: number, bitsPerFrame: number): void;

    setState(newState: any) {
        let changed = false;
        for (const key in newState) {
            if (this.state[key] !== newState[key]) {
                this.state[key] = newState[key];
                changed = true;
            }
        }
        if (changed) {
            this.stateChanged = true;
            this.observeStateMutation('setState', undefined, true);
        }
    }

    private estimateCpuHz(): number {
        const key = String(this.type || '').toLowerCase();
        if (/(rp2040|pico)/.test(key)) return 125_000_000;
        if (/esp32/.test(key)) return 80_000_000;
        if (/stm32/.test(key)) return 72_000_000;
        return 16_000_000;
    }

    private calcFreq(): number {
        const updates = Number(this.telemetryRuntime.updateCount || 0);
        if (updates <= 0) return 0;

        const first = this.telemetryRuntime.firstCpuCycles;
        const last = this.telemetryRuntime.lastCpuCycles;
        if (first !== null && last !== null && last > first) {
            const simSeconds = (last - first) / this.estimateCpuHz();
            if (simSeconds > 0) {
                return Number((updates / simSeconds).toFixed(3));
            }
        }

        const elapsedMs = Math.max(1, Date.now() - this.telemetryRuntime.createdAtMs);
        return Number((updates / (elapsedMs / 1000)).toFixed(3));
    }

    private getPathValue(source: any, pathLike: string): any {
        const path = String(pathLike || '').trim();
        if (!path) return undefined;

        const rawParts = path.split('.').map((p) => p.trim()).filter(Boolean);
        if (rawParts.length === 0) return undefined;

        // Support manifest-style "state.foo.bar" keys where source is already the state object.
        const parts = String(rawParts[0] || '').toLowerCase() === 'state'
            ? rawParts.slice(1)
            : rawParts;

        if (parts.length === 0) return source;

        let current: any = source;
        for (const part of parts) {
            if (!current || typeof current !== 'object') return undefined;
            current = current[part];
        }
        return current;
    }

    private isLikelySignalActive(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
        if (typeof value === 'string') {
            const key = value.trim().toLowerCase();
            if (!key) return false;
            if (['0', 'false', 'off', 'ok', 'none', 'idle'].includes(key)) return false;
            return true;
        }
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value).length > 0;
        return false;
    }

    private mergeSeverity(current: TelemetrySeverity, next: TelemetrySeverity): TelemetrySeverity {
        if (current === 'error' || next === 'error') return 'error';
        if (current === 'warn' || next === 'warn') return 'warn';
        return 'ok';
    }

    private applyHeuristics() {
        const findings: string[] = [];
        let status: 'ok' | 'warn' | 'error' = 'ok';

        const addFinding = (msg: string, sev: 'warn' | 'error') => {
            findings.push(msg);
            if (status !== 'error') status = sev;
            if (this.telemetryEnabled && this.onTelemetryFinding) {
                this.onTelemetryFinding({ summary: msg, severity: sev });
            }
        };

        const snapshot = this.state && typeof this.state === 'object'
            ? (this.state as Record<string, any>)
            : {};

        for (const [key, value] of Object.entries(snapshot)) {
            const lower = String(key || '').toLowerCase();
            if (/(error|fault|burned|panic|critical|failed)/.test(lower) && this.isLikelySignalActive(value)) {
                addFinding('error', `State flag ${key} indicates an error condition.`);
            } else if (/(warn|degraded|timeout|unstable|retry)/.test(lower) && this.isLikelySignalActive(value)) {
                addFinding('warn', `State flag ${key} indicates a warning condition.`);
            }
        }

        const criticalKeys = Array.isArray(this.telemetryManifest?.criticalKeys)
            ? this.telemetryManifest?.criticalKeys || []
            : [];
        for (const key of criticalKeys) {
            const value = this.getPathValue(snapshot, key);
            if (value === undefined) {
                addFinding('warn', `Critical telemetry key missing: ${key}`);
                continue;
            }

            const lower = String(key || '').toLowerCase();
            if (/(error|fault|burned|panic|critical|failed)/.test(lower) && this.isLikelySignalActive(value)) {
                addFinding('error', `Critical key ${key} is active.`);
            }
        }

        const idleMs = Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));
        if (this.telemetryRuntime.updateCount > 40 && idleMs > 8000) {
            addFinding('warn', `State has been stable for ${Math.round(idleMs)}ms while updates continue.`);
        }

        const vccSamples = this.telemetryRuntime.power.vccSamples;
        const gndSamples = this.telemetryRuntime.power.gndSamples;
        if (vccSamples > 0 || gndSamples > 0) {
            const delta = this.telemetryRuntime.power.vccCurrent - this.telemetryRuntime.power.gndCurrent;
            if (delta < 0.25) {
                addFinding('warn', 'Power rail delta appears too small (possible underpower/unwired condition).');
            }
        }

        const stateSize = this.safeSerializeState().length;
        if (stateSize > 256_000) {
            addFinding('warn', `State payload is large (${stateSize} bytes).`);
        }

        const avgMs = this.telemetryRuntime.updateCount > 0 ? this.telemetryRuntime.totalUpdateTimeMs / this.telemetryRuntime.updateCount : 0;
        if (avgMs > 20.0) {
            addFinding('error', `Critical update latency: ${avgMs.toFixed(2)}ms avg.`);
        } else if (avgMs > 5.0) {
            addFinding('warn', `High update latency: ${avgMs.toFixed(2)}ms avg.`);
        }

        if (this.telemetryRuntime.updateCount > 30 && this.telemetryRuntime.lastUpdateAtMs > 0) {
            const sinceLastUpdateMs = Math.max(0, Date.now() - this.telemetryRuntime.lastUpdateAtMs);
            if (sinceLastUpdateMs > 2000) {
                addFinding('warn', `Component updates appear infrequent (last update ${Math.round(sinceLastUpdateMs)}ms ago).`);
            }
        }

        if (this.telemetryRuntime.updateCount > 30 && this.calcFreq() > 0 && this.calcFreq() < 2) {
            addFinding('warn', `Component update frequency appears low (${this.calcFreq().toFixed(2)}Hz).`);
        }

        if (
            this.telemetryRuntime.updateCount > 120 &&
            this.telemetryRuntime.onEventCount === 0 &&
            this.telemetryRuntime.stateMutationCount === 0
        ) {
            addFinding('warn', 'No events or state changes observed during runtime; component may be stale/inactive.');
        }

        const result: TelemetryHeuristicResult = findings.length === 0 ? {
            status: 'ok',
            summary: 'OK: No anomalies detected.',
            findings: [],
        } : {
            status,
            summary: `${String(status).toUpperCase()}: ${findings[0]}`,
            findings,
        };
        this.telemetryRuntime.lastHeuristicStatus = result;
        return result;
    }

    onCustomTelemetry(): void {
        // Override in subclasses
    }

    protected setCustomTelemetry(payload: Record<string, any> | null | undefined): void {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            this.telemetryRuntime.customTelemetry = {};
            return;
        }
        this.telemetryRuntime.customTelemetry = { ...payload };
    }

    protected getStateIdleMs(): number {
        return Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));
    }

    protected getUpdateTimingMetrics(): { avgMs: number; maxMs: number; totalMs: number; count: number } {
        const count = Number(this.telemetryRuntime.updateCount || 0);
        const totalMs = Number(this.telemetryRuntime.totalUpdateTimeMs || 0);
        const maxMs = Number(this.telemetryRuntime.maxUpdateTimeMs || 0);
        return {
            avgMs: count > 0 ? totalMs / count : 0,
            maxMs,
            totalMs,
            count,
        };
    }

    private getUniversalMetrics() {
        const stateSize = this.safeSerializeState().length;
        const stateAgeMs = Math.max(0, Date.now() - Number(this.telemetryRuntime.lastStateChangeAtMs || Date.now()));

        this.telemetryRuntime.customTelemetry = {};
        try {
            this.onCustomTelemetry();
        } catch {
            // Non-fatal telemetry hook.
        }

        // If the component didn't provide custom telemetry, create a lightweight
        // best-effort snapshot from top-level state keys so grading receives
        // useful signals without requiring per-component edits.
        try {
            const ct = this.telemetryRuntime.customTelemetry || {};
            const hasCustom = Object.keys(ct).length > 0;
            if (!hasCustom && this.state && typeof this.state === 'object') {
                const keys = Object.keys(this.state).slice(0, 12);
                for (const k of keys) {
                    try {
                        (this.telemetryRuntime.customTelemetry as any)[k] = this.normalizeStateForTelemetry(this.state[k]);
                    } catch {
                        // ignore individual key failures
                    }
                }
            }
        } catch {
            // Best-effort; telemetry should never throw the host update path.
        }

        const timing = this.getUpdateTimingMetrics();

        return {
            updateFreq: this.calcFreq(),
            timing: {
                totalMs: timing.totalMs,
                maxMs: timing.maxMs,
                avgMs: timing.avgMs,
                count: timing.count,
                lastUpdateAtMs: this.telemetryRuntime.lastUpdateAtMs,
            },
            pinToggles: { ...this.telemetryRuntime.pinToggles },
            stateSize,
            stateStability: {
                lastStateChangeAtMs: this.telemetryRuntime.lastStateChangeAtMs,
                lastStateChangeCycles: this.telemetryRuntime.lastStateChangeCycles,
                stateMutationCount: this.telemetryRuntime.stateMutationCount,
                idleMs: stateAgeMs,
            },
            ioThroughput: {
                i2cTransactions: this.telemetryRuntime.io.i2cTransactions,
                i2cBytes: this.telemetryRuntime.io.i2cBytes,
                spiTransactions: this.telemetryRuntime.io.spiTransactions,
                spiBytes: this.telemetryRuntime.io.spiBytes,
                uartBytes: this.telemetryRuntime.io.uartBytes,
                lastIoAtMs: this.telemetryRuntime.lastIoAtMs,
            },
            interactionAudit: {
                onEventCount: this.telemetryRuntime.onEventCount,
                onPinStateChangeCount: this.telemetryRuntime.onPinStateChangeCount,
                byType: { ...this.telemetryRuntime.interactionsByType },
                lastEventAtMs: this.telemetryRuntime.lastEventAtMs,
            },
            powerProfile: {
                vcc: {
                    current: this.telemetryRuntime.power.vccCurrent,
                    average: Number(this.telemetryRuntime.power.vccAverage.toFixed(4)),
                    samples: this.telemetryRuntime.power.vccSamples,
                },
                gnd: {
                    current: this.telemetryRuntime.power.gndCurrent,
                    average: Number(this.telemetryRuntime.power.gndAverage.toFixed(4)),
                    samples: this.telemetryRuntime.power.gndSamples,
                },
                railDelta: Number((this.telemetryRuntime.power.vccCurrent - this.telemetryRuntime.power.gndCurrent).toFixed(4)),
            },
            custom: this.telemetryRuntime.customTelemetry || {},
        };
    }

    // Method 1: Human-readable summary
    getTelemetrySummary(): string {
        this.observeStateMutation('summary', undefined, true);
        return this.applyHeuristics().summary;
    }

    // Method 2: Deep-state payload
    getTelemetryData(): Record<string, any> {
        this.observeStateMutation('telemetry', undefined, true);
        const heuristics = this.applyHeuristics();
        const source = this.state && typeof this.state === 'object' && !Array.isArray(this.state)
            ? this.state
            : { value: this.state };
        const metrics = this.getUniversalMetrics();
        const metricsRecord = metrics as Record<string, any>;

        return {
            ...source,
            customTelemetry: (metricsRecord.custom && typeof metricsRecord.custom === 'object') ? metricsRecord.custom : {},
            _metrics: metrics,
            _heuristics: heuristics,
            _manifestTelemetry: this.telemetryManifest || undefined,
            _capturedAt: new Date().toISOString(),
        };
    }

    getSyncState() {
        return this.state;
    }

    getRawMetrics() {
        return {
            id: this.id,
            type: this.type,
            state: this.getSyncState(),
            metrics: this.getUniversalMetrics(),
            heuristics: this.applyHeuristics(),
            capturedAt: new Date().toISOString()
        };
    }

    getDeltaMetrics() {
        const full = this.getRawMetrics();
        
        // Stabilize metrics for comparison (remove volatile timing fields)
        const stableMetrics = { ...full.metrics };
        if (stableMetrics.lifecycle) {
            stableMetrics.lifecycle = { ...stableMetrics.lifecycle };
            delete (stableMetrics.lifecycle as any).idleMs;
        }
        if (stableMetrics.ioThroughput) {
            stableMetrics.ioThroughput = { ...stableMetrics.ioThroughput };
            delete (stableMetrics.ioThroughput as any).lastIoAtMs;
        }
        if (stableMetrics.interactionAudit) {
            stableMetrics.interactionAudit = { ...stableMetrics.interactionAudit };
            delete (stableMetrics.interactionAudit as any).lastEventAtMs;
        }

        const currentJson = JSON.stringify(stableMetrics);
        if (currentJson === this.lastReportedJson) {
            return {
                id: this.id,
                type: this.type,
                state: this.getSyncState(),
                delta: false,
                metrics: full.metrics,  // CRITICAL: Always include metrics so telemetry capture doesn't lose custom metrics
                heuristics: full.heuristics,
                capturedAt: full.capturedAt
            };
        }
        this.lastReportedJson = currentJson;
        return {
            ...full,
            state: this.getSyncState(),
            delta: true
        };
    }
}
