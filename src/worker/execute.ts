import { BoardRunner, AVRRunnerOptions } from './registries/component-registry.ts';

export async function createRunnerForBoard(
    boardType: string,
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string } = {}
): Promise<BoardRunner> {
    const t = String(boardType || '').toLowerCase();
    // Pico (RP2040) over pico-emu. Matches openhw-pico + wokwi aliases.
    if (t.includes('pico') || t.includes('rp2040')) {
        const { PicoRunner } = await import('./runners/pico-runner.ts');
        return new PicoRunner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    // ESP32 DevKit over esp32-emu.
    if (t.includes('esp32')) {
        const { Esp32Runner } = await import('./runners/esp32-runner.ts');
        return new Esp32Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    // STM32F1 Blue Pill over stm32f1-emu.
    if (t.includes('stm32') && (t.includes('f1') || t.includes('bluepill') || t.includes('blue-pill') || t.includes('103'))) {
        const { Stm32f1Runner } = await import('./runners/stm32f1-runner.ts');
        return new Stm32f1Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
    }
    // STM32F4 Discovery over stm32f4-emu (F407 default; F401/F411/F429 via attrs).
    if (t.includes('stm32') || t.includes('f4') || t.includes('407') || t.includes('discovery')) {
        const { Stm32f4Runner } = await import('./runners/stm32f4-runner.ts');
        return new Stm32f4Runner(hexData, componentsDef, wiresDef, onStateUpdate, options);
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
