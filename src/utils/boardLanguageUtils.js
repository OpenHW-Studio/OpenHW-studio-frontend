/**
 * SHARED UTILITY: boardLanguageUtils.js
 *
 * Single source of truth for "what source language / file extension does this
 * board edit?" The family data lives in src/worker/boards-registry.ts; this
 * module is the one place that turns a board TYPE (or a normalized kind) into
 * a language + extension + default main-file name.
 *
 * Consumers: projectCompilerUtils (compile-unit resolver), projectUtils /
 * SimulatorPage / mobileui (main-file creation and rename), boardLoopPrologue
 * (active main path), genericBoardCompile (compile payload language), and the
 * e2e probe in SimulatorPage.
 *
 * Rules (board type wins; the MicroPython/CircuitPython env attr only upgrades
 * a board that would otherwise compile Arduino source — retro ASM always wins):
 *   python      .py   pi3/pi4/pi5, micro:bit v2, env=micropython/py/circuitpython
 *   assembly    .asm  retro 8086/8085/8051/6502/z80/rv32 (and generic retro)
 *   arduino     .ino  AVR, Pico/RP2040/RP2350, ESP32/ESP32SC, STM32, default
 */
import { matchBoardFamily } from '../worker/boards-registry.ts';

export const BOARD_LANGUAGE_DEFS = Object.freeze({
  python: Object.freeze({ language: 'python', extension: '.py', mainFileName: 'main.py' }),
  assembly: Object.freeze({ language: 'assembly', extension: '.asm', mainFileName: '' }),
  arduino: Object.freeze({ language: 'arduino', extension: '.ino', mainFileName: '' }),
});

/** Extensions that belong to each language (secondary C/C++ headers included). */
export const BOARD_LANGUAGE_EXTENSIONS = Object.freeze({
  python: Object.freeze(['.py']),
  assembly: Object.freeze(['.asm', '.s', '.a51']),
  arduino: Object.freeze(['.ino', '.h', '.hpp', '.c', '.cpp']),
});

function attrValue(attrs, key) {
  const raw = attrs?.[key];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    if (typeof raw.value === 'string') return raw.value;
    if (typeof raw.default === 'string') return raw.default;
  }
  return '';
}

/**
 * @param {string} boardTypeOrKind board component type (openhw-…) or a
 *   normalized kind (pi3, retro_8086, rp2040, …).
 * @param {{env?: string, rp2040Mode?: string, attrs?: object}} [options]
 * @returns {{language: 'python'|'assembly'|'arduino', extension: string, mainFileName: string, family: object}}
 */
export function resolveBoardLanguage(boardTypeOrKind, options = {}) {
  const raw = String(boardTypeOrKind || '').trim();
  const lower = raw.toLowerCase();
  // Normalized kinds are shorter than the registry matchers ('pi3' vs
  // 'openhw-pi3'); expand them before matching so both call styles agree.
  const expanded = /^(pi3|pi4|pi5)$/i.test(lower) ? `openhw-${lower}` : raw;
  const family = matchBoardFamily(expanded);
  const familyKey = String(family?.family || '').toLowerCase();
  const firmware = Array.isArray(family?.firmware) ? family.firmware : [];

  const isRetro = familyKey.startsWith('retro')
    || firmware.includes('asm-source')
    || /^(retro|8086|8088|8085|8051|mcs-51|mcs51|6502|z80|z-80|rv32|riscv)/i.test(lower);
  if (isRetro) return { ...BOARD_LANGUAGE_DEFS.assembly, family };

  // MicroPython/CircuitPython on ESP32/Pico remains .py: the board's env attr
  // (or legacy rp2040Mode) selects the REPL-script path, never arduino-cli.
  const rawEnv = options?.env ?? attrValue(options?.attrs, 'env') ?? options?.rp2040Mode ?? '';
  const env = String(
    rawEnv && typeof rawEnv === 'object'
      ? (rawEnv.value ?? rawEnv.default ?? '')
      : rawEnv,
  ).toLowerCase();
  if (env.includes('micropython') || env === 'py' || env.includes('circuitpython')) {
    return { ...BOARD_LANGUAGE_DEFS.python, family };
  }

  if (familyKey === 'python' || familyKey.startsWith('pi')
    || firmware.includes('python-script') || familyKey === 'microbit_v2') {
    return { ...BOARD_LANGUAGE_DEFS.python, family };
  }
  return { ...BOARD_LANGUAGE_DEFS.arduino, family };
}

/** Language code used on compile payloads and code-file records. */
export function boardLanguageCode(boardTypeOrKind, options = {}) {
  return resolveBoardLanguage(boardTypeOrKind, options).language;
}

/** Default main-file name for a board. Python boards keep the `main.py`
 *  convention already used by the MicroPython/Pyodide runners; all other
 *  languages use `<boardId>.<ext>`. */
export function getBoardMainFileName(boardTypeOrKind, boardId, options = {}) {
  const def = resolveBoardLanguage(boardTypeOrKind, options);
  return def.mainFileName || `${boardId}${def.extension}`;
}

/** Main-file extension for a board ('.py' / '.asm' / '.ino'). */
export function getBoardMainExtension(boardTypeOrKind, options = {}) {
  return resolveBoardLanguage(boardTypeOrKind, options).extension;
}

/** Set of source extensions valid for a board's compile unit. */
export function getBoardAllowedExtensions(boardTypeOrKind, options = {}) {
  const def = resolveBoardLanguage(boardTypeOrKind, options);
  return new Set(BOARD_LANGUAGE_EXTENSIONS[def.language]);
}
