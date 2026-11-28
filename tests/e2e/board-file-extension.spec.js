import { test, expect } from '@playwright/test';

/**
 * Board main-file extension follows the SELECTED BOARD TYPE.
 *
 * Regression: different boards need .py / .asm / .ino, but switching boards
 * often left the old extension (and its stale compile unit) active. The
 * mapping source is src/utils/boardLanguageUtils.js (data from
 * src/worker/boards-registry.ts); this spec proves it in the real editor.
 *
 * Every cell creates a circuit through window.OpenHWE2E, reads the editor's
 * own boardFileProbe(), and checks:
 *   - visible main-file name/extension,
 *   - the file's `language` field,
 *   - the compile-unit language (what compileGenericBoard sends),
 *   - and the actual firmware/compile payload path after a short Run.
 */
const CASES = [
  {
    tag: 'PI3',
    type: 'openhw-pi3',
    id: 'pi1',
    attrs: { env: 'micropython' },
    code: "print('PI3_BOARD_FILE_OK')\n",
    main: 'main.py', ext: '.py', language: 'python', payload: 'PYSCRIPT',
  },
  {
    tag: 'MICROBIT',
    type: 'openhw-microbit-v2',
    id: 'mb1',
    attrs: {},
    code: "print('MICROBIT_BOARD_FILE_OK')\n",
    main: 'main.py', ext: '.py', language: 'python', payload: 'PYSCRIPT',
  },
  {
    tag: 'I8086',
    type: 'openhw-8086',
    id: 'r86',
    attrs: {},
    code: 'ORG 100h\nMOV AH, 09h\nMOV DX, OFFSET msg\nINT 21h\nMOV AH, 4Ch\nINT 21h\nmsg: DB \'ASM_OK$\'\nEND\n',
    main: 'r86.asm', ext: '.asm', language: 'assembly', payload: 'ASM',
  },
  {
    tag: 'ESP32',
    type: 'openhw-esp32',
    id: 'e32',
    attrs: {},
    code: 'void setup() { Serial.begin(9600); }\nvoid loop() {}\n',
    main: 'e32.ino', ext: '.ino', language: 'arduino', payload: 'arduino',
  },
  {
    tag: 'PICO',
    type: 'openhw-pico',
    id: 'pico1',
    attrs: {},
    code: 'void setup() { Serial1.begin(9600); }\nvoid loop() {}\n',
    main: 'pico1.ino', ext: '.ino', language: 'arduino', payload: 'arduino',
  },
  {
    tag: 'STM32F4',
    type: 'openhw-stm32f4',
    id: 'f41',
    attrs: {},
    code: 'void setup() {}\nvoid loop() {}\n',
    main: 'f41.ino', ext: '.ino', language: 'arduino', payload: 'arduino',
  },
];

function extOf(name) {
  const i = String(name || '').lastIndexOf('.');
  return i < 0 ? '' : String(name).slice(i).toLowerCase();
}

async function openSimulator(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem('openhw-tour-completed', 'true');
  });
  await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => !!window.OpenHWE2E?.boardFileProbe, null, { timeout: 90000 });
}

test.describe('Board file extension follows board type', () => {
  test.setTimeout(180000);

  let compileRequests;
  test.beforeEach(async ({ page }) => {
    compileRequests = [];
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    // Last registered route wins: stub compile so a board's payload can be
    // captured without depending on a real backend toolchain.
    await page.route('**/compile', async (route) => {
      try { compileRequests.push(route.request().postDataJSON()); } catch { /* ignore */ }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ hex: ':00000001FF', buildId: 'board-file-extension-stub' }),
      });
    });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
  });

  test('shared mapping: board families resolve to the expected language/extension', async ({ page }) => {
    await openSimulator(page);
    const map = await page.evaluate(async () => {
      const lib = await import('/src/utils/boardLanguageUtils.js');
      const reg = await import('/src/worker/boards-registry.ts');
      return {
        pi3: lib.resolveBoardLanguage('openhw-pi3'),
        pi4: lib.resolveBoardLanguage('openhw-pi4'),
        pi5: lib.resolveBoardLanguage('openhw-pi5'),
        microbit: lib.resolveBoardLanguage('openhw-microbit-v2'),
        esp32sc: lib.resolveBoardLanguage('openhw-esp32sc'),
        pico: lib.resolveBoardLanguage('openhw-pico'),
        f4: lib.resolveBoardLanguage('openhw-stm32f4'),
        retro: ['openhw-8086', 'openhw-8085', 'openhw-8051', 'openhw-6502', 'openhw-z80', 'openhw-rv32']
          .map((t) => lib.resolveBoardLanguage(t).extension),
        esp32scFamily: reg.matchBoardFamily('openhw-esp32sc').family,
        micropyPico: lib.resolveBoardLanguage('openhw-pico', { env: 'micropython' }),
      };
    });
    for (const key of ['pi3', 'pi4', 'pi5', 'microbit']) {
      expect(map[key].language).toBe('python');
      expect(map[key].extension).toBe('.py');
    }
    expect(map.retro).toEqual(['.asm', '.asm', '.asm', '.asm', '.asm', '.asm']);
    for (const key of ['esp32sc', 'pico', 'f4']) {
      expect(map[key].language).toBe('arduino');
      expect(map[key].extension).toBe('.ino');
    }
    expect(map.micropyPico.language).toBe('python'); // env override preserved
    expect(map.esp32scFamily).toBe('esp32sc'); // family block untouched
  });

  for (const c of CASES) {
    test(`${c.tag} (${c.type}): ${c.main} + ${c.language} compile path`, async ({ page }) => {
      await openSimulator(page);
      const setup = await page.evaluate(({ type, id, attrs, code }) => window.OpenHWE2E.setupCircuit({
        components: [{ id, type, attrs, x: 100, y: 100 }],
        wires: [],
        code,
      }), { type: c.type, id: c.id, attrs: c.attrs, code: c.code });
      expect(setup.ok).toBe(true);

      // The normalization effect creates/renames the board's main file.
      await page.waitForFunction(({ id, main }) => {
        const p = window.OpenHWE2E.boardFileProbe();
        const b = (p.boards || []).find((x) => x.boardId === id);
        return b?.mainFile?.name === main;
      }, { id: c.id, main: c.main }, { timeout: 20000 });

      const before = await page.evaluate(() => window.OpenHWE2E.boardFileProbe());
      const b = before.boards.find((x) => x.boardId === c.id);
      expect(b.expectedLanguage).toBe(c.language);
      expect(b.expectedExtension).toBe(c.ext);
      expect(b.mainFile.name).toBe(c.main);
      expect(extOf(b.mainFile.name)).toBe(c.ext);
      expect(b.mainFile.language).toBe(c.language);
      expect(b.compileUnit.language).toBe(c.language);
      expect(b.compileUnit.mainFileName).toBe(c.main);
      expect(b.compileUnit.hasMainFile).toBe(true);
      // No stale other-language main file may remain enabled.
      expect(b.enabledMainFiles.every((f) => f.ext === c.ext)).toBe(true);

      // Short Run: exercises the real firmware-payload path. For arduino
      // boards the intercepted POST body is the compile payload itself.
      await page.evaluate(() => window.OpenHWE2E.run({ forMs: 400 }));
      const after = await page.evaluate(() => window.OpenHWE2E.boardFileProbe());
      const probe = after.boards.find((x) => x.boardId === c.id);
      expect(probe.payloadKind).toBe(c.payload);
      if (c.language === 'arduino') {
        const payload = compileRequests.find((p) => p && p.language);
        expect(payload, 'compile POST must carry board language').toBeTruthy();
        expect(payload.language).toBe('arduino');
        expect(payload.sketchName).toBe(c.id);
        expect(after.lastCompilePayload.language).toBe('arduino');
      } else {
        // Python/ASM boards never reach arduino-cli: their payload is the
        // PYSCRIPT / ASM sentinel, and no compile POST may be sent.
        expect(compileRequests.some((p) => p?.sketchName === c.id)).toBe(false);
      }
      await page.evaluate(() => window.OpenHWE2E.stop());
    });
  }

  test('switching an existing circuit Pi3 → ESP32 retargets the main file and tab', async ({ page }) => {
    await openSimulator(page);
    const setup = await page.evaluate(() => window.OpenHWE2E.setupCircuit({
      components: [{ id: 'sw1', type: 'openhw-pi3', attrs: { env: 'micropython' }, x: 100, y: 100 }],
      wires: [],
      code: "print('BEFORE_SWITCH')\n",
    }));
    expect(setup.ok).toBe(true);
    await page.waitForFunction(() => {
      const b = window.OpenHWE2E.boardFileProbe().boards.find((x) => x.boardId === 'sw1');
      return b?.mainFile?.name === 'main.py';
    }, null, { timeout: 20000 });
    const py = await page.evaluate(() => window.OpenHWE2E.boardFileProbe());
    expect(py.boards[0].mainFile.language).toBe('python');
    expect(py.boards[0].activeFileId).toBe('project/sw1/main.py');

    const switched = await page.evaluate(() => window.OpenHWE2E.switchBoardType({
      componentId: 'sw1', type: 'openhw-esp32', attrs: {},
    }));
    expect(switched.ok).toBe(true);

    await page.waitForFunction(() => {
      const b = window.OpenHWE2E.boardFileProbe().boards.find((x) => x.boardId === 'sw1');
      return b?.mainFile?.name === 'sw1.ino';
    }, null, { timeout: 20000 });

    const after = await page.evaluate(() => window.OpenHWE2E.boardFileProbe());
    const b = after.boards.find((x) => x.boardId === 'sw1');
    expect(b.expectedLanguage).toBe('arduino');
    expect(b.mainFile.ext).toBe('.ino');
    expect(b.mainFile.language).toBe('arduino');
    expect(b.mainFile.disabled).toBe(false);
    expect(b.compileUnit.language).toBe('arduino');
    expect(b.compileUnit.hasMainFile).toBe(true);
    // The visible editor tab and active buffer followed the rename, and the
    // old Python file is no longer an enabled compile candidate.
    expect(b.openTabs).toContain('project/sw1/sw1.ino');
    expect(b.activeFileId).toBe('project/sw1/sw1.ino');
    expect(b.enabledMainFiles.every((f) => f.ext === '.ino')).toBe(true);
  });
});
