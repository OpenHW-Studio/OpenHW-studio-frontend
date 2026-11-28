import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { ArmRunnerBase } from '../../../src/worker/runners/arm-runner-base.ts';

const decode = ArmRunnerBase.prototype.dispatchBitBangI2C;

function fakeRunner() {
  const calls = [];
  const endpoints = {
    L2: [{ inst: {
      onI2CStart: (address, read) => calls.push(['start', address, read]),
      onI2CByte: (_address, data) => calls.push(['byte', data]),
      onI2CStop: () => calls.push(['stop']),
    }, pinId: 'SDA', id: 'c1' }],
    L3: [{ inst: {
      onI2CStart: (address, read) => calls.push(['start', address, read]),
      onI2CByte: (_address, data) => calls.push(['byte', data]),
      onI2CStop: () => calls.push(['stop']),
    }, pinId: 'SCL', id: 'c1' }],
  };
  return {
    calls,
    ctx: {
      boardId: 'r86',
      pinToNet: new Map([['r86:L2', 1], ['r86:L3', 2]]),
      i2cBitState: new Map(),
      getProtocolEndpointsForPin: (pin) => endpoints[pin].map((e) => ({ ...e, inst: { ...e.inst, id: 'c1' } })),
    },
  };
}

const edge = (ctx, pin, high) => decode.call(ctx, pin, high);
const putBit = (ctx, high) => {
  edge(ctx, 'L3', false); // ensure SCL low
  edge(ctx, 'L2', high);  // SDA settles while SCL low
  edge(ctx, 'L3', true);  // rising SCL samples SDA
};
const putByte = (ctx, byte) => { for (let i = 7; i >= 0; i--) putBit(ctx, !!(byte & (1 << i))); };

describe('bit-bang I2C decoder (retro GPIO bus)', () => {
  test('decodes START, address, data and STOP', () => {
    const { ctx, calls } = fakeRunner();
    edge(ctx, 'L2', false); // START while SCL high
    edge(ctx, 'L3', false); // SCL low after START
    putByte(ctx, 0x40);     // address 0x20, write
    putByte(ctx, 0x6b);     // data
    edge(ctx, 'L3', false); // SCL low
    edge(ctx, 'L2', false); // SDA low
    edge(ctx, 'L3', true);  // SCL high
    edge(ctx, 'L2', true);  // STOP
    assert.deepEqual(calls, [['start', 0x20, false], ['byte', 0x6b], ['stop']]);
  });

  test('ignores clocks without START', () => {
    const { ctx, calls } = fakeRunner();
    putByte(ctx, 0x40);
    assert.deepEqual(calls, []);
  });
});
