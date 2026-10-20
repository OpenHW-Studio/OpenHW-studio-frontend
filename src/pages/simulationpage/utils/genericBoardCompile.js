import { boardCompToDisplayName } from "./hardwareUtils";
import { getCachedHex, setCachedHex } from "../../../services/offlineCache.js";
import { compileCode } from "../../../services/simulatorService.js";

/**
 * Generic per-board compile domain: arduino sketches for every board family.
 * (library.txt read, shared-cache key, compileCode, cache write,
 *  boardHexMap + first-firmware-wins result.)
 *
 * Artifact + firmware-payload contract per board family:
 *   uno/nano  → artifacts ['hex','elf'], boardHexMap = compiled.hex (Intel HEX text)
 *   rp2040    → artifacts ['uf2','elf'], boardHexMap = compiled.hex (UF2BASE64:…)
 *   esp32     → artifacts ['bin','elf'], boardHexMap = base64 .bin (raw, no prefix)
 *   stm32f1/4 → artifacts ['bin','elf'], boardHexMap = base64 .bin (raw, no prefix)
 * Runners auto-detect (ELF magic / ':' HEX / raw bin) so payload shape drifts
 * don't break boot. MicroPython boards skip compile: the runner boots the
 * bundled MP image + injects main.py over the REPL (see runners + gap docs).
 *
 * Pure function of (args, ctx); returns { result }. Mutations flow through
 * ctx.boardHexMap.
 */
export async function compileGenericBoard(args, ctx) {
  const {
    boardComp,
    kind,
    targetFqbn,
    compileUnit,
    compileSource,
    projectFiles,
    activeCodeFileId,
    code,
  } = args;
  const {
    boardHexMap,
    appendConsoleEntry,
    logSerial,
    logCompileSummary,
  } = ctx;
  let { result } = ctx;
            const libFile = (projectFiles || []).find(f => f.path === `project/${boardComp.id}/library.txt`);
            const librariesTxt = libFile
              ? (libFile.id === activeCodeFileId ? code : (libFile.content || ''))
              : '';

            // USB-CDC mode (board attr `usbCdc`): the guest keeps arduino-pico's
            // `Serial` (the real USB CDC device) instead of the UART0 monitor
            // path, so the USB-DEV cell can prove the CDC itself. It changes
            // the compiled source, so it MUST be part of the cache key.
            const usbCdcAttr = String((boardComp && boardComp.attrs && boardComp.attrs.usbCdc) ?? '').toLowerCase();
            const usbCdcMode = usbCdcAttr === '1' || usbCdcAttr === 'true' || usbCdcAttr === 'on' || usbCdcAttr === 'yes';

            const cacheKeyBoard = `${kind}:${boardComp.id}${usbCdcMode ? ':usbcdc' : ''}`;
            const cacheSource = [
              compileSource,
              targetFqbn,
              ...compileUnit.files.map((f) => `${f.name}\n${f.content || ''}`),
              librariesTxt,
            ].join('\n/*__SPLIT__*/\n');

            appendConsoleEntry(
              "info",
              `Compiling for ${boardCompToDisplayName(boardComp, kind)}...`,
              "simulator",
            );
            let compiled = await getCachedHex(cacheSource, cacheKeyBoard);
            if (compiled) {
              logSerial(`Using cached compilation for ${boardComp.id}...`);
            } else {
              logSerial(`Compiling ${boardComp.id}...`);
              // Per-family artifacts: the backend registry decides supported
              // names; arduino-cli emits them from the installed core.
              // Pico kinds: rp2040/rp2350 + pico_w/pico_2_w/pico_eth/pico_2_eth.
              // STM32 kinds: stm32f1/stm32f4 + all variant kinds (start with
              // 'stm32' / contain 'f103'/'f4' — same bin+elf contract).
              const isPicoKind = kind === 'rp2040' || kind === 'rp2350' || String(kind || '').startsWith('pico');
              const isStmKind = String(kind || '').startsWith('stm32') || kind === 'stm32f1' || kind === 'stm32f4';
              const artifacts =
                isPicoKind ? ['uf2', 'elf'] :
                kind === 'esp32' ? ['bin', 'elf'] :
                isStmKind ? ['bin', 'elf'] :
                ['hex', 'elf'];
              // Pico Serial compat: arduino-pico `Serial` is USB CDC, which
              // pico-emu does not model — UART0 (GP0/GP1) is the monitor
              // path. Rewrite bare `Serial.` → `Serial1.` (word-boundary,
              // Serial1/Serial2 untouched) before compile.
              //
              // GLOBAL replace (the `g` flag is load-bearing): without it
              // `String.replace` rewrites only the FIRST `Serial.` in the
              // sketch, so every LATER print/println stayed on USB CDC and
              // was silently dropped by the guest (arduino-pico's
              // `SerialUSB::write` discards data while the CDC is not
              // connected). Symptom seen live 2026-10-20 on every Pico
              // board: the sketch's first output line never reached the
              // monitor and the Pico-2 EEPROM cell produced NO serial at
              // all (its payload prints all sat on the CDC).
              let effectiveSource = compileSource;
              let effectiveFiles = compileUnit.files;
              if (isPicoKind && !usbCdcMode) {
                const rewriteSerial = (src) => String(src || '').replace(/\bSerial\.(?![0-9])/g, 'Serial1.');
                // Only rewrite when the sketch actually uses bare Serial.
                if (/\bSerial\.(?![0-9])/.test(String(compileSource || ''))) {
                  effectiveSource = rewriteSerial(compileSource);
                }
                effectiveFiles = (compileUnit.files || []).map((f) =>
                  /\bSerial\.(?![0-9])/.test(String(f.content || ''))
                    ? { ...f, content: rewriteSerial(f.content) }
                    : f,
                );
              }
              try {
                compiled = await compileCode({
                  code: effectiveSource,
                  files: effectiveFiles,
                  sketchName: compileUnit.sketchName,
                  fqbn: targetFqbn,
                  target: kind,
                  libraries_txt: librariesTxt,
                  artifacts,
                });
                setCachedHex(cacheSource, cacheKeyBoard, compiled);
              } catch (compileErr) {
                throw compileErr;
              }
            }

            boardHexMap[boardComp.id] = compiled.hex;
            logCompileSummary(compiled, boardComp, kind);
            if (!result) result = compiled;

  return { result };
}
