import { describe, it, expect } from 'vitest';
import { retroAsmSnippet } from '../../../src/workers/autowiring.worker.ts';

const components = [{ id: 'r86', type: 'openhw-8086' }, { id: 'r51', type: 'openhw-8051' }];
const wires = [{ from: 'c1:A', to: 'r86:L2' }, { from: 'c1:A', to: 'r51:L2' }];
const snippet = { globals: '', setup: 'digitalWrite(${A}, HIGH);', loop: '' };
const manifest = {
  autocoding: {
    retro: {
      8086: ['MOV AL, ${MASK}', 'OUT 0E0h, AL'],
      8051: ['ANL P1, #${NOTMASK}'],
    },
  },
};

describe('retro autocode', () => {
  it('emits 8086 ASM with the wired pin mask', () => {
    const asm = retroAsmSnippet(snippet, 'c1', wires, components, 'retro_8086', manifest);
    expect(asm).toContain('MOV AL, 04h');
    expect(asm).toContain('OUT 0E0h, AL');
    expect(asm).toContain('autocoding for c1 start');
  });

  it('emits 8051 sink form from the component-folder template', () => {
    const asm = retroAsmSnippet(snippet, 'c1', wires, components, 'retro_8051', manifest);
    expect(asm).toContain('ANL P1, #0FBh');
  });

  it('falls back to a generic template when the manifest has none', () => {
    const asm = retroAsmSnippet(snippet, 'c1', wires, components, 'retro_8085', {});
    expect(asm).toContain('MVI A, 04h');
  });

  it('returns null for a non-retro board', () => {
    expect(retroAsmSnippet(snippet, 'c1', wires, components, 'arduino_uno', manifest)).toBeNull();
  });
});
