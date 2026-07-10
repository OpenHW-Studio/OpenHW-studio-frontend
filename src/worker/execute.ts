import { BoardRunner, AVRRunnerOptions } from './registries/component-registry.ts';

export async function createRunnerForBoard(
    boardType: string,
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string; esp32SimulationMode?: string } = {}
): Promise<BoardRunner> {
    if (/(esp32)/i.test(String(boardType || ''))) {
        const { BackendProxyRunner } = await import('./runners/backend-proxy-runner.ts');
        return new BackendProxyRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    if (/(stm32)/i.test(String(boardType || ''))) {
        const { BackendProxyRunner } = await import('./runners/backend-proxy-runner.ts');
        return new BackendProxyRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    if (/pico|rp2040/i.test(String(boardType || ''))) {
        // RP2040 path: emulate firmware in rp2040js with optional flash partitions.
        const { RP2040Runner } = await import('./runners/rp2040-runner.ts');
        return new RP2040Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    const { AVRRunner } = await import('./runners/avr-runner.ts');
    return new AVRRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
}

// 100% backward compatibility re-exports
export * from './fs/fs-builders.ts';
export * from './registries/component-registry.ts';
export * from './protocol-handlers/gates.ts';
export * from './protocol-handlers/keypad.ts';
export * from './protocol-handlers/sd-card.ts';
export * from './protocol-handlers/simulation-monitor.ts';
