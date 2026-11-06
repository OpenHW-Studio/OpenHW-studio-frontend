import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  collectI2CSlaveAddresses,
  createI2CBridge,
  createSPIBridge,
  isSPISelected,
  levelPassiveNets,
  spiBusForSck,
} from '../../../src/worker/bus-bridge.ts';

// Shared bus-bridge contract, headless (fake component instances).
function i2cSlave(id, addr, log) {
  return {
    id, i2cAddr: addr,
    onI2CStart(a) { log.push(['start', id, a]); return (a & 0x7f) === addr; },
    onI2CByte(_a, v) { log.push(['byte', id, v]); return true; },
    onI2CReadByte() { log.push(['read', id]); return 0x42; },
    onI2CStop() { log.push(['stop', id]); },
  };
}

function ctxFor(instances, posts = []) {
  const map = new Map(instances.map((i) => [i.id, i]));
  return {
    boardId: 'b1', instances: map, compAttrById: new Map(),
    onStateUpdate: (m) => posts.push(m), getSimTimeMs: () => 1234, posts,
  };
}

describe('bus bridge (ARM I2C/SPI)', () => {
  test('collects slave addresses generically (field, getter, attrs)', () => {
    const a = { id: 'x', i2cAddr: 0x3c, onI2CStart() {} };
    const b = { id: 'y', getI2CAddress: () => 0x27, onI2CStart() {} };
    const c = { id: 'z', onI2CStart() {} };
    const ctx = ctxFor([a, b, c]);
    ctx.compAttrById.set('z', { addr: '0x48' });
    assert.deepEqual(collectI2CSlaveAddresses(ctx).sort(), [0x27, 0x3c, 0x48]);
  });

  test('first-ACK-wins routing, addressed-only bytes, stop-to-all', () => {
    const log = [];
    const ctx = ctxFor([i2cSlave('oled', 0x3c, log), i2cSlave('eeprom', 0x50, log)]);
    const br = createI2CBridge(ctx);
    br.start(0x3c, false);
    br.write(0x00);
    br.write(0xae);
    br.stop();
    const oledBytes = log.filter((e) => e[1] === 'oled').map((e) => e[0]);
    const epBytes = log.filter((e) => e[1] === 'eeprom').map((e) => e[0]);
    assert.deepEqual(oledBytes, ['start', 'byte', 'byte', 'stop']);
    // eeprom NACKs 0x3C: no bytes, but stop fans out (AVR parity).
    assert.deepEqual(epBytes, ['start', 'stop']);
    const proto = ctx.posts.find((m) => m.type === 'protocol:i2c');
    assert.ok(proto, 'protocol lane posted');
    assert.deepEqual(proto.data, [0x00, 0xae]);
    assert.equal(proto.address, 0x3c);
  });

  test('read serves the active slave byte, idle 0xFF', () => {
    const log = [];
    const ctx = ctxFor([i2cSlave('s', 0x48, log)]);
    const br = createI2CBridge(ctx);
    assert.equal(br.read(), 0xff);
    br.start(0x48, true);
    assert.equal(br.read(), 0x42);
    br.stop();
  });

  test('CS gating: low selects, high deselects, none always', () => {
    const mk = (pins, volts) => ({
      pins, getPinVoltage: (p) => volts[p] ?? 0,
    });
    assert.equal(isSPISelected(mk({ CS: 1 }, { CS: 0 })), true);
    assert.equal(isSPISelected(mk({ CS: 1 }, { CS: 1 })), false);
    assert.equal(isSPISelected(mk({}, {})), true);
    assert.equal(isSPISelected(mk({ SDA: 1 }, { SDA: 0 })), true);
  });

  test('SPI exchange routes to selected only + records frames', () => {
    const seen = [];
    const sel = { id: 'rfid', pins: { CS: 1 }, getPinVoltage: () => 0, onSPIByte: (v) => { seen.push(v); return 0x92; } };
    const desel = { id: 'other', pins: { CS: 1 }, getPinVoltage: () => 1, onSPIByte: (v) => { seen.push(['other', v]); return 0; } };
    const ctx = ctxFor([sel, desel]);
    const br = createSPIBridge(ctx);
    assert.equal(br.exchange(0x10, 0), 0x92);
    assert.equal(br.exchange(0x20, 1), 0x92);
    assert.deepEqual(seen, [0x10, 0x20]);
    br.frame(true);
    assert.deepEqual(ctx.posts[0].data, [0x10, 0x20]);
    assert.equal(ctx.posts[0].type, 'protocol:spi');
  });

  test('SCK pin resolves bus per family', () => {
    assert.equal(spiBusForSck('openhw-stm32-bluepill', 'PA5'), 1);
    assert.equal(spiBusForSck('openhw-stm32-bluepill', 'PB13'), 2);
    assert.equal(spiBusForSck('openhw-esp32', 'GPIO18'), 1);
    assert.equal(spiBusForSck('whatever', 'X1'), 0);
  });

  test('board-level CS wins over stale model pins', async () => {
    const mod = await import('../../../src/worker/bus-bridge.ts');
    // Net 7: bp1:PA4 <-> mx1:CS. Runner mirror says LOW (selected),
    // model pin still reads HIGH (stale propagation).
    const pinToNet = new Map([['bp1:PA4', 7], ['mx1:CS', 7]]);
    const inst = { id: 'mx1', pins: { CS: 1 }, getPinVoltage: () => 3.3 };
    const ctx = {
      boardId: 'bp1', instances: new Map([['mx1', inst]]),
      onStateUpdate: () => {}, getSimTimeMs: () => 0,
      pinToNet, boardPinLevel: () => false,
    };
    assert.equal(mod.boardCsSelected(ctx, inst), true);
    assert.equal(mod.isSPISelected(inst), false);
  });

  test('levelPassiveNets fans model-driven HIGH across component nets', async () => {
    const mod = await import('../../../src/worker/bus-bridge.ts');
    const mk = (volts) => {
      const pins = { X: { voltage: volts } };
      return {
        id: 'c1', type: 'openhw-74hc595',
        getPinVoltage: (p) => pins[p]?.voltage ?? 0,
        setPinVoltage: (p, v) => { pins[p] = { voltage: v }; },
        _pins: pins,
      };
    };
    const drv = mk(5.0);
    const led = { id: 'l1', type: 'openhw-led', getPinVoltage: (p) => (p === 'A' ? 0 : 0), setPinVoltage(p, v) { this._v = v; }, _v: 0 };
    const pinToNet = new Map([['c1:X', 3], ['l1:A', 3], ['b1:PA4', 5], ['c2:Y', 5]]);
    const drv2 = mk(0);
    const inst = new Map([['c1', drv], ['l1', led], ['c2', drv2]]);
    mod.levelPassiveNets('b1', pinToNet, inst);
    assert.equal(led._v, 5.0);
    // Untouched: driver-less net stays 0, board nets skipped.
    assert.equal(drv2._pins.X.voltage, 0);
  });
});
