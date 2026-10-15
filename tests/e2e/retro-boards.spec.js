import { test, expect } from '@playwright/test';

// Retro 8/16-bit verification over the OpenHWE2E loop —
// setupCircuit → run → verdict with serial evidence.
// No backend compile: .asm source is assembled IN-WASM by 8086emu.
// Covers: 8086, 8085, 8051, 6502, Z80 (+ rv32 best-effort).
test.describe('Retro boards UART console (8086emu, asm-first)', () => {
  test.setTimeout(600000);

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/compile')) return route.continue();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
  });

  // [boardId, boardType, asm source, needle]
  const boardCases = [
    ['r86', 'openhw-8086',
      `ORG 100h\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nMOV AH, 4Ch\nINT 21h\nmsg: DB 'HELLO_R86!$'\nEND`,
      'HELLO_R86'],
    ['r88', 'openhw-8088',
      `ORG 100h\nMOV DX, OFFSET msg\nMOV AH, 09h\nINT 21h\nMOV AH, 4Ch\nINT 21h\nmsg: DB 'HELLO_R88!$'\nEND`,
      'HELLO_R88'],
    ['r85', 'openhw-8085',
      `    MVI C, 05h\n    LXI H, msg\nloop:\n    MOV A, M\n    CPI '$'\n    JZ done\n    OUT 01h\n    INX H\n    JMP loop\ndone:\n    HLT\nmsg: DB 'HELLO_R85!', '$'\nEND`,
      'HELLO_R85'],
    ['r51', 'openhw-8051',
      `    MOV DPTR, #msg\n    MOV R1, #00h\nloop:\n    MOV A, R1\n    MOVC A, @A+DPTR\n    JZ done\n    MOV SBUF, A\n    INC R1\n    SJMP loop\ndone:\n    SJMP done\nmsg: DB 'HELLO_R51!', 0\nEND`,
      'HELLO_R51'],
    ['r65', 'openhw-6502',
      // NOTE: package 6502 DB takes one literal per DB (verified against
      // repo hello6502.asm); multi-char DB strings do not assemble.
      `    ORG 0\n    LDX #0\nloop:\n    LDA msg,X\n    BEQ done\n    STA $01\n    INX\n    JMP loop\ndone:\n    BRK\nmsg: DB 'H'\n    DB 'i'\n    DB 10\n    DB 0\n    END\n`,
      'Hi'],
    ['rz80', 'openhw-z80',
      // NOTE: package Z80 assembler has no forward label refs (verified:
      // LD HL,label fails); unrolled OUT sequence like repo helloz80.asm.
      `    ORG 0\n    LD A, 'H'\n    OUT (1), A\n    LD A, 'i'\n    OUT (1), A\n    LD A, 10\n    OUT (1), A\n    HALT\n    END\n`,
      'Hi'],
    ['rrv', 'openhw-rv32',
      // RV32 hello via the tiny ECALL ABI (repo hellorv32.asm).
      `    ORG 0\n    ADDI a1, x0, 0x100\n    ADDI a2, x0, 3\n    ADDI a7, x0, 64\n    ECALL\n    ADDI a7, x0, 93\n    ECALL\n    ORG 0x100\n    DB 'H','i',10\n    END\n`,
      'Hi'],
  ];

  for (const [boardId, boardType, asm, needle] of boardCases) {
    test(`console output: ${boardType}`, async ({ page }) => {
      const errors = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      await page.addInitScript(() => {
        window.localStorage.setItem('openhw-tour-completed', 'true');
      });
      await page.goto('/simulator', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(8000);

      const setup = await page.evaluate(
        ({ boardId, boardType, asm }) =>
          window.OpenHWE2E.setupCircuit({
            components: [{ id: boardId, type: boardType, attrs: {}, x: 100, y: 100 }],
            wires: [],
            code: asm,
          }),
        { boardId, boardType, asm },
      );
      expect(setup.ok).toBe(true);

      const verdict = await page.evaluate(
        ({ needle }) => window.OpenHWE2E.run({ forMs: 25000, serialNeedle: needle, telemetryMode: 'detail' }),
        { needle },
      );
      console.log(`${boardType} verdict:`, JSON.stringify({
        pass: verdict.pass, reasons: verdict.reasons,
        serialLines: verdict.serialLines, serialHead: (verdict.serial || '').slice(0, 200),
      }));
      expect(verdict.ok).toBe(true);
      expect(verdict.pass).toBe(true);
      await page.evaluate(() => window.OpenHWE2E.stop());
      await page.waitForTimeout(2000);
    });
  }
});
