import { AVRRunner } from './runners/avr-runner.ts';
import { RP2040Runner } from './runners/rp2040-runner.ts';
import { ESP32Runner } from './runners/esp32-runner.ts';
import { BackendProxyRunner } from './runners/backend-proxy-runner.ts';
import { BoardRunner, AVRRunnerOptions } from './registries/component-registry.ts';

export function createRunnerForBoard(
    boardType: string,
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string; esp32SimulationMode?: string } = {}
): BoardRunner {
    if (/(esp32)/i.test(String(boardType || ''))) {
        if (options.esp32SimulationMode === 'frontend') {
            return new ESP32Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
        } else {
            return new BackendProxyRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
        }
    }
    if (/(stm32)/i.test(String(boardType || ''))) {
        return new BackendProxyRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    if (/pico|rp2040/i.test(String(boardType || ''))) {
        // RP2040 path: emulate firmware in rp2040js with optional flash partitions.
        return new RP2040Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    return new AVRRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
}

// 100% backward compatibility re-exports
export * from './fs/fs-builders.ts';
export * from './registries/component-registry.ts';
export * from './protocol-handlers/gates.ts';
export * from './protocol-handlers/keypad.ts';
export * from './protocol-handlers/sd-card.ts';
export * from './protocol-handlers/simulation-monitor.ts';
