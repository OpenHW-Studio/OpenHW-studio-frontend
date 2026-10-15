import { BoardRunner, AVRRunnerOptions } from './registries/component-registry.ts';

// Merge user-selected attrs (chip, arch, board, …) into runner options.
// Attrs arrive as plain strings OR {value}/{default} wrapper objects (the
// shell manifests + SimulatorPage both use wrappers); unwrap defensively.
function attrStr(attrs: any, ...keys: string[]): string {
    for (const key of keys) {
        const raw = (attrs as any)?.[key];
        if (typeof raw === 'string' && raw.trim()) return raw.trim();
        if (raw && typeof raw === 'object') {
            if (typeof raw.value === 'string' && raw.value.trim()) return raw.value.trim();
            if (typeof raw.default === 'string' && raw.default.trim()) return raw.default.trim();
        }
    }
    return '';
}

function deriveOpts(
    comp: any,
    options: AVRRunnerOptions & { pyScript?: string },
): AVRRunnerOptions & { pyScript?: string } {
    const attrs = (comp as any)?.attrs || {};
    const extra: Record<string, unknown> = {};
    const chip = attrStr(attrs, 'chip');
    if (chip) extra.chip = chip;
    const arch = attrStr(attrs, 'arch');
    if (arch) extra.arch = arch;
    const board = attrStr(attrs, 'board');
    if (board) extra.board = board;
    const wifi = attrStr(attrs, 'wirelessMode', 'wifi');
    if (wifi) extra.wirelessMode = wifi;
    const spi = attrStr(attrs, 'boardSpi', 'board-spi', 'spi');
    if (spi) extra.boardSpi = spi;
    const ethLive = attrStr(attrs, 'ethLive', 'board-live', 'boardLive');
    if (ethLive) extra.ethLive = ethLive;
    if (Object.keys(extra).length === 0) return options as any;
    return { ...(options as any), ...extra } as any;
}

export async function createRunnerForBoard(
    boardType: string,
    hexData: string,
    componentsDef: any[],
    wiresDef: any[],
    onStateUpdate: (state: any) => void,
    options: AVRRunnerOptions & { pyScript?: string } = {}
): Promise<BoardRunner> {
    const t = String(boardType || '').toLowerCase();
    const comp = (componentsDef || []).find((c: any) => String(c?.id) === String((options as any)?.boardId))
        || (componentsDef || []).find((c: any) => String(c?.type || '').toLowerCase() === t)
        || (componentsDef || [])[0];
    const merged = deriveOpts(comp, options);
    // Pico (RP2040) + Pico 2 (RP2350) over pico-emu. Matches openhw-pico,
    // openhw-pico-2/-w/2-w/-eth/-2-eth + wokwi aliases. boardType flows into
    // options so the runner picks arch (M0 vs M33/RV32) without extra plumbing.
    if (t.includes('pico') || t.includes('rp2040') || t.includes('rp2350') || t.includes('2350')) {
        const { PicoRunner } = await import('./runners/pico-runner.ts');
        return new PicoRunner(hexData, componentsDef, wiresDef, onStateUpdate, { ...merged, boardType } as any);
    }
    // ESP32 DevKit over esp32-emu.
    if (t.includes('esp32')) {
        const { Esp32Runner } = await import('./runners/esp32-runner.ts');
        return new Esp32Runner(hexData, componentsDef, wiresDef, onStateUpdate, { ...merged, boardType } as any);
    }
    // STM32F1 Blue Pill + variants over stm32f1-emu (chip opt: c8/cb/rc,
    // maple_mini, nucleo_f103rb, gd32_*). maple/nucleo/gd32 aliases included.
    if (t.includes('stm32') && (t.includes('f1') || t.includes('bluepill') || t.includes('blue-pill') || t.includes('103') || t.includes('maple') || t.includes('nucleo') || t.includes('gd32'))) {
        const { Stm32f1Runner } = await import('./runners/stm32f1-runner.ts');
        return new Stm32f1Runner(hexData, componentsDef, wiresDef, onStateUpdate, { ...merged, boardType } as any);
    }
    // STM32F4 Discovery + variants over stm32f4-emu (chip opt: F401/F411/F407/F407VE/F429).
    if (t.includes('stm32') || t.includes('f4') || t.includes('407') || t.includes('401') || t.includes('411') || t.includes('429') || t.includes('discovery')) {
        const { Stm32f4Runner } = await import('./runners/stm32f4-runner.ts');
        return new Stm32f4Runner(hexData, componentsDef, wiresDef, onStateUpdate, { ...merged, boardType } as any);
    }
    // Retro 8/16-bit boards over 8086emu (ISA opt/attr: 8086/8088/8085/8051/
    // 6502/Z80/rv32; board TYPE implies it). ASM-first: no compiler needed.
    if (t.includes('8086') || t.includes('8088') || t.includes('8085') || t.includes('8051') || t.includes('mcs-51') || t.includes('mcs51') || t.includes('6502') || t.includes('z80') || t.includes('z-80') || t.includes('rv32') || t.includes('risc') || t.includes('retro')) {
        const { RetroRunner } = await import('./runners/retro-runner.ts');
        return new RetroRunner(hexData, componentsDef, wiresDef, onStateUpdate, { ...merged, boardType } as any);
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
