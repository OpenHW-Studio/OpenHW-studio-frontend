// Bus-framer parity (§12.4): each *BusFramer agrees bit-for-bit with its
// *Protocol base (shared statics/thresholds). Run: npx vitest run
// tests/unit/worker/bus-framer-parity.test.mjs
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';

// NOTE: @openhw/emulator resolves via workspace alias (see vite.config).
// Relative fallback keeps the test runnable without alias config.
import { TwoWireProtocol, TwoWireBusFramer } from '@openhw/emulator/src/protocol-handlers/twowire-device.ts';
import { DigitalProtocol, DigitalBusFramer } from '@openhw/emulator/src/protocol-handlers/digital-device.ts';
import { AnalogProtocol, AnalogBusFramer } from '@openhw/emulator/src/protocol-handlers/analog-device.ts';
import { NeoPixelProtocol, NeoPixelBusFramer } from '@openhw/emulator/src/protocol-handlers/neopixel-device.ts';
import { PwmBusFramer } from '@openhw/emulator/src/protocol-handlers/pwm-device.ts';
import { I2SProtocol, I2sBusFramer } from '@openhw/emulator/src/protocol-handlers/i2s-device.ts';
import { OneWireBusFramer } from '@openhw/emulator/src/protocol-handlers/onewire-device.ts';
import { UartBusFramer } from '@openhw/emulator/src/protocol-handlers/uart-device.ts';
import { PulseBusFramer } from '@openhw/emulator/src/protocol-handlers/pulse-device.ts';

const man = (pins = ['DIO', 'CLK']) => ({ type: 'x', attrs: {}, pins: pins.map((id) => ({ id })) });

describe('bus-framer parity', () => {
  test('twowire: real TM1637 order decodes 0xA5 identically', () => {
    for (const mk of [
      () => {
        const got = [];
        const o = new (class extends TwoWireProtocol {
          onTwoWireByteReceived(d) { got.push(d); }
        })('t', man());
        return { feed: (p, v) => o.onPinStateChange(p, v, 0), got };
      },
      () => {
        const got = [];
        const fr = new TwoWireBusFramer({ onByte: (d) => got.push(d) });
        return { feed: (p, v) => fr.pushPin(p, v), got };
      },
    ]) {
      const { feed, got } = mk();
      feed('DIO', false); // START (lines idle HIGH/HIGH)
      const byte = 0xa5;
      feed('CLK', false);
      for (let bit = 0; bit < 8; bit++) {
        feed('DIO', ((byte >> bit) & 1) === 1);
        feed('CLK', true);
        feed('CLK', false);
      }
      feed('CLK', true); // 9th ACK clock -> byte ready
      feed('DIO', true); // STOP
      assert.deepEqual(got, [0xa5]);
    }
  });

  test('digital: debounce + edge fan-out identical', () => {
    const mk = (onEdge) => ({
      proto: new (class extends DigitalProtocol {
        onPinEdge(p, h) { onEdge.push(`${p}:${h}`); }
      })('t', { type: 'x', attrs: { debounceMs: 1 }, pins: [{ id: 'IN' }] }),
      framer: new DigitalBusFramer(16000, { onEdge: (p, h) => onEdge.push(`${p}:${h}`) }),
    });
    const gotP = [];
    const gotF = [];
    const { proto } = mk(gotP);
    const { framer } = mk(gotF);
    // @100 debounced in BOTH (100-0 < 16000); @200 no-change; then edges.
    for (const [p, v, c] of [['IN', true, 100], ['IN', true, 200], ['IN', false, 20000], ['IN', true, 40000]]) {
      proto.onPinStateChange(p, v, c);
      framer.pushEdge(p, v, c);
    }
    assert.deepEqual(gotP, ['IN:false', 'IN:true']);
    assert.deepEqual(gotF, gotP);
  });

  test('analog: threshold trips identical', () => {
    const proto = new AnalogProtocol('t', { type: 'x', attrs: { avgSamples: 4, voltageThreshold: 0.05 }, pins: [{ id: 'AO' }] });
    proto.pins = { AO: { voltage: 0 } };
    const tripsP = [];
    const tripsF = [];
    const orig = proto.onAnalogVoltageChange.bind(proto);
    proto.onAnalogVoltageChange = (_p, avg) => { tripsP.push(Math.round(avg * 1000)); orig(_p, avg, 0); };
    const fr = new AnalogBusFramer(4, 0.05, { onChange: (_p, avg) => tripsF.push(Math.round(avg * 1000)) });
    for (const v of [1, 1, 1, 1, 3, 3, 3, 3]) {
      proto.pins.AO.voltage = v;
      proto.update();
      fr.pushSample('AO', v);
    }
    assert.ok(tripsP.length > 0);
    assert.deepEqual(tripsF, tripsP);
  });

  test('neopixel: same edges decode red+green identically', () => {
    const bytes = [0, 255, 0, 255, 0, 0]; // LED0 red, LED1 green (GRB)
    const drive = (push) => {
      let cyc = 100000;
      push(true, cyc);
      for (const b of bytes)
        for (let bit = 7; bit >= 0; bit--) {
          const one = ((b >> bit) & 1) === 1;
          cyc += one ? 13 : 6;
          push(false, cyc);
          cyc += 6;
          push(true, cyc);
        }
      cyc += 5000;
      push(false, cyc);
      cyc += 5000;
      push(true, cyc);
    };
    const gotP = [];
    const proto = new (class extends NeoPixelProtocol {
      onNeoPixelFrame(p) { gotP.push(p); }
    })('t', man(['DIN']));
    proto.cpuFreqMHz = 16;
    drive((h, c) => proto.onPinStateChange('DIN', h, c));
    const gotF = [];
    const fr = new NeoPixelBusFramer(16, { onFrame: (p) => gotF.push(p) });
    drive((h, c) => fr.pushEdge(h, c));
    assert.equal(gotP.length, 1);
    assert.deepEqual(gotP[0], [0xff0000, 0x00ff00]);
    assert.deepEqual(gotF, gotP);
  });

  test('pwm: settles on 4th stable sample, glitch rejected', () => {
    const fr = new PwmBusFramer({ onSignal: () => {} });
    assert.equal(fr.pushSample('SIG', 1000, 0.5, 500, 1000, 0), null);
    assert.equal(fr.pushSample('SIG', 1000, 0.5, 500, 1000, 5), null);
    assert.equal(fr.pushSample('SIG', 1000, 0.5, 500, 1000, 10), null);
    const s4 = fr.pushSample('SIG', 1000, 0.5, 500, 1000, 20);
    assert.ok(s4 && Math.abs(s4.frequencyHz - 1000) < 1 && Math.abs(s4.dutyCycle - 0.5) < 1e-9);
    assert.equal(fr.pushSample('SIG', 1000, 0.5, 0.2, 1000, 40), null);
  });

  test('i2s: normalize clamps; time+count rules mirror base', () => {
    assert.equal(I2SProtocol.normalizeSample(2147483648), 1.0);
    assert.equal(I2SProtocol.normalizeSample(-3000000000), -1.0);
    assert.ok(Math.abs(I2SProtocol.normalizeSample(1073741824) - 0.5) < 1e-9);
    let chunks = 0;
    let chunkLen = 0;
    const fr = new I2sBusFramer(1024, { onChunk: (c) => { chunks++; chunkLen = c.length; } });
    for (let i = 0; i < 1024; i++) fr.pushFrame(i % 2, 0.1, 1000);
    assert.equal(chunks, 1);
    assert.equal(chunkLen, 129);
    assert.equal(fr.pending, 895);
  });

  test('onewire: SKIP ROM + READ SCRATCHPAD returns 0xA5 LSB-first', () => {
    const fr = new OneWireBusFramer({ onReadScratchpad: () => [0xa5] });
    fr.reset();
    assert.equal(fr.state, 'RESET');
    for (const bit of [0, 0, 1, 1, 0, 0, 1, 1]) fr.writeBit(bit); // 0xCC
    assert.equal(fr.state, 'FUNCTION_CMD');
    for (const bit of [0, 1, 1, 1, 1, 1, 0, 1]) fr.writeBit(bit); // 0xBE
    assert.equal(fr.state, 'DATA');
    assert.equal(fr.pollSlot(), 1); // IGNORE slot after command byte
    const bits = [];
    for (let i = 0; i < 8; i++) bits.push(fr.pollSlot());
    assert.deepEqual(bits, [1, 0, 1, 0, 0, 1, 0, 1]);
    assert.equal(bits.reduce((acc, b, i) => acc | (b << i), 0), 0xa5);
  });

  test('uart: byte counting', () => {
    let n = 0;
    const fr = new UartBusFramer({ onByte: () => n++ });
    fr.pushByte(0x41);
    fr.pushByte(0x42);
    assert.equal(n, 2);
    assert.equal(fr.rxBytes, 2);
  });

  test('pulse: durations in microseconds', () => {
    const got = [];
    const fr = new PulseBusFramer({ onPulse: (_p, _h, d) => got.push(d) });
    fr.pushEdge('ECHO', true, 1000);
    const d = fr.pushEdge('ECHO', false, 1160); // 160 cycles = 10us
    assert.ok(d !== null && Math.abs(d - 10) < 1e-9 && got.length === 1);
    assert.equal(new PulseBusFramer({}).pushEdge('X', true, 5), null);
  });
});
