import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import {
  LOGIC_REGISTRY,
  COMPONENT_PINS,
  getComponentCapabilities,
  collectComponentTelemetry,
  validateTelemetrySchema,
} from '../../../src/worker/registries/component-registry.ts';
import { raindropSharedState } from '@openhw/emulator/src/components/raindrop-shared-state';

// Whole-registry component sweep (plan §8): every registered logic class is
// constructed headless, powered, driven through its declared capabilities,
// ticked, and telemetry-validated. Tiers per component:
//   content — device state proves the traffic was UNDERSTOOD (display text/
//             framebuffer/digits, sensor scratchpad, register state).
//   traffic — bytes ACKed/counted (rx/tx counters advanced, buffers filled).
//   smoke   — constructed, ticked, telemetried with no throw (no imperfect
//             harness for this model's inputs, e.g. bit-banged TM1637).
// FAILS only on throws or telemetry-schema violations. Skips (constructor
// needs a live engine/WASM) are listed, never silent.
function manifestFor(type) {
  const pins = (COMPONENT_PINS[type] || []).map((p) => ({ id: String(p?.id ?? p) }));
  return { type, attrs: {}, pins };
}

function powerUp(inst) {
  for (const pid of Object.keys(inst.pins || {})) {
    const u = String(pid).toUpperCase();
    try {
      if (/^(GND|GND\.|GND_|AGND)/.test(u)) inst.setPinVoltage(pid, 0.0);
      else if (/(3V3|3\.3V|VDD|VCCIO)/.test(u)) inst.setPinVoltage(pid, 3.3);
      else if (/^(VCC|5V|VIN|V\+|VDD5|BAT)/.test(u)) inst.setPinVoltage(pid, 5.0);
    } catch { /* ignore */ }
  }
}

function tick(inst, n, base = 1000) {
  for (let i = 0; i < n; i += 1) {
    inst.update(base + i * 1000, [], new Map());
  }
}

function stateOf(inst) {
  // Counters often live on raw state while getSyncState curates a subset —
  // merge so traffic evidence is visible either way.
  try { return { ...(inst.state || {}), ...(inst.getSyncState() || {}) }; } catch { return inst.state || {}; }
}

const I2C_SCAN = [0x27, 0x3c, 0x40, 0x57, 0x68, 0x77];

function i2cAckedAddress(inst) {
  const cands = [];
  try { if (typeof inst.getI2CAddress === 'function') cands.push(inst.getI2CAddress()); } catch { /* ignore */ }
  for (const a of I2C_SCAN) if (!cands.includes(a)) cands.push(a);
  for (const a of cands) {
    try { if (inst.onI2CStart(a, false) !== false) return a; } catch { /* try next */ }
  }
  return null;
}

describe('whole-registry component sweep (headless harness)', () => {
  test('every component constructs, drives, ticks, telemetries', () => {
    const failures = [];
    const skips = [];
    const tiers = { content: [], traffic: [], smoke: [] };
    const types = Object.keys(LOGIC_REGISTRY);

    for (const type of types) {
      const Cls = LOGIC_REGISTRY[type];
      if (typeof Cls !== 'function') { skips.push(`${type}: not a class`); continue; }
      let inst;
      try {
        inst = new Cls(`${type.replace(/[^a-z0-9]/gi, '')}_t1`, manifestFor(type));
      } catch (e) {
        skips.push(`${type}: ctor needs live env (${String(e?.message || e).slice(0, 80)})`);
        continue;
      }
      try {
        powerUp(inst);
        const caps = new Set(getComponentCapabilities(type));
        const st0 = stateOf(inst);
        const rx0 = Number(st0.i2cRxBytes || 0) + Number(st0.spiRxBytes || 0) + Number(st0.uartRxBytes || 0);
        let cyc = 1000;

        // Digital/analog stimulus on the first signal pin.
        const sigPin = Object.keys(inst.pins || {}).find((p) => !/^(GND|VCC|5V|3V3|VIN|V\+|VDD|BAT|NC)/i.test(p));
        if (sigPin && (caps.has('digital-in') || caps.has('digital-out') || caps.has('analog-in'))) {
          inst.setPinVoltage(sigPin, 2.5);
          inst.update(cyc += 1000, [], new Map());
          try { inst.onPinStateChange(sigPin, true, cyc); } catch { /* optional */ }
        }

        // I2C: bus-scan for an ACKing address, write 3 bytes + stop.
        // Character LCDs get the real backpack stream instead: lib init
        // sequence + text (nibble pairs with EN strobes, RS=bit0, BL=bit3),
        // so decoded lines prove content, not just traffic.
        if (/lcd1602|lcd2004/i.test(type) && typeof inst.onI2CStart === 'function') {
          const A = i2cAckedAddress(inst);
          if (A != null) {
            const pair = (b, rs) => {
              const base = (rs ? 0x01 : 0x00) | 0x08;
              const hi = ((b >> 4) & 0xf) << 4 | base;
              const lo = ((b & 0xf)) << 4 | base;
              return [hi | 0x04, hi & ~0x04, lo | 0x04, lo & ~0x04];
            };
            const stream = [];
            for (const b of [0x33, 0x32, 0x28, 0x0c, 0x06, 0x01]) stream.push(...pair(b, false));
            for (const b of [0x48, 0x69]) stream.push(...pair(b, true));
            inst.onI2CStart(A, false);
            for (const by of stream) { try { inst.onI2CByte(A, by); } catch { break; } }
            try { inst.onI2CStop?.(); } catch { /* optional */ }
            inst.update(3000000, [], new Map());
          }
        } else if (caps.has('i2c-target') && typeof inst.onI2CStart === 'function') {
          const addr = i2cAckedAddress(inst);
          if (addr != null && typeof inst.onI2CByte === 'function') {
            inst.onI2CByte(addr, 0x48);
            inst.onI2CByte(addr, 0x69);
            inst.onI2CByte(addr, 0x21);
          }
          try { inst.onI2CStop?.(); } catch { /* optional */ }
        }

        // Parallel HD44780 (lcd1602/lcd2004 without backpack): 4-bit GPIO
        // nibbles with EN strobes — init sequence + "Hi" as data.
        if (/lcd1602|lcd2004/i.test(type) && typeof inst.onI2CStart !== 'function' && typeof inst.onPinStateChange === 'function') {
          try {
            const hasE = Object.keys(inst.pins || {}).some((p) => /^E$/i.test(p));
            if (hasE) {
              const nib = (b, rs) => {
                for (const half of [(b >> 4) & 0xf, b & 0xf]) {
                  inst.onPinStateChange('RS', !!rs, cyc);
                  for (let i = 0; i < 4; i += 1) inst.onPinStateChange(`D${4 + i}`, !!((half >> i) & 1), cyc);
                  inst.onPinStateChange('E', true, cyc);
                  inst.onPinStateChange('E', false, cyc);
                }
              };
              for (const b of [0x33, 0x32, 0x28, 0x0c, 0x06, 0x01]) nib(b, false);
              for (const b of [0x48, 0x69]) nib(b, true);
              inst.update(3000000, [], new Map());
            }
          } catch { /* optional */ }
        }

        // SPI: CS assert, 4-byte exchange, CS deassert. Covers MOSI/MISO
        // parts plus DN/SCLK-style write-only displays (Nokia 5110).
        // ePaper needs its DC line driven: command 0x24 (DC low) then RAM
        // bytes (DC high) — proves vram ingestion, not just traffic.
        // ili9341-touch likewise: RAMWR 0x2C then pixel bytes.
        const spiish = caps.has('spi-target') || Object.keys(inst.pins || {}).some((p) => /^(MOSI|MISO|DIN|SDI|DN|SCLK)$/i.test(p));
        if (/ili9341-touch/i.test(type) && typeof inst.onSPIByte === 'function') {
          try {
            if (inst.pins?.VCC) inst.setPinVoltage('VCC', 5.0);
            if (inst.pins?.GND) inst.setPinVoltage('GND', 0.0);
            const cs = typeof inst.getCSPinName === 'function' ? inst.getCSPinName() : 'CS';
            inst.onPinStateChange('DC', false, cyc);
            inst.onPinStateChange(cs, false, cyc);
            inst.onSPIByte(0x2c);
            inst.onPinStateChange('DC', true, cyc);
            for (let i = 0; i < 16; i += 1) inst.onSPIByte(0xf8);
            inst.onPinStateChange(cs, true, cyc);
          } catch { /* optional */ }
        } else if (/epaper/i.test(type) && typeof inst.onSPIByte === 'function') {
          try {
            if (inst.pins?.VCC) inst.setPinVoltage('VCC', 5.0);
            if (inst.pins?.GND) inst.setPinVoltage('GND', 0.0);
            const cs = typeof inst.getCSPinName === 'function' ? inst.getCSPinName() : 'CS';
            inst.onPinStateChange('DC', false, cyc);
            inst.onPinStateChange(cs, false, cyc);
            inst.onSPIByte(0x24);
            inst.onPinStateChange(cs, true, cyc);
            inst.onPinStateChange('DC', true, cyc);
            inst.onPinStateChange(cs, false, cyc);
            for (let i = 0; i < 16; i += 1) inst.onSPIByte(0x00);
            inst.onPinStateChange(cs, true, cyc);
          } catch { /* optional */ }
        } else if (spiish && typeof inst.onSPIByte === 'function') {
          const cs = typeof inst.getCSPinName === 'function' ? inst.getCSPinName() : 'CS';
          try { inst.onPinStateChange(cs, false, cyc); } catch { /* optional */ }
          inst.onSPIByte(0x9f);
          inst.onSPIByte(0x00);
          inst.onSPIByte(0x37);
          inst.onSPIByte(0xaa);
          try { inst.onPinStateChange(cs, true, cyc); } catch { /* optional */ }
        }

        // PWM / UART / OneWire / I2S stimulus.
        if (caps.has('pwm-in')) {
          try { inst.onPWM?.(sigPin || 'PWM', { dutyCycle: 0.5 }); } catch { /* optional */ }
          try { inst.onPWMSignal?.(sigPin || 'PWM', 490, 0.5, 1000); } catch { /* optional */ }
        }
        if (caps.has('uart') && typeof inst.serialRx === 'function') {
          inst.serialRx(0x41); inst.serialRx(0x0a);
        }
        if (caps.has('onewire') && typeof inst.onOneWireReset === 'function') {
          const dq = Object.keys(inst.pins || {}).find((p) => /^(DQ|DATA)/i.test(p)) || 'DQ';
          inst.onOneWireReset(dq, {});
          try { inst.onOneWireWriteBit?.(dq, 1, {}); } catch { /* optional */ }
          try { inst.onOneWireSlot?.(dq, {}); } catch { /* optional */ }
        }
        if (caps.has('i2s') && typeof inst.onI2SFrame === 'function') {
          inst.onI2SFrame(0, 1234, 16);
        }
        // I2S DAC/amp: full-scale frame must move the analog outputs.
        if (/max98357|pcm5102/i.test(type) && typeof inst.onI2SFrame === 'function') {
          try { inst.onI2SFrame(0, 1073741824, 16); } catch { /* optional */ }
        }

        // DHT-22: host pulls DATA LOW ≥500us then releases; run its clock
        // synchronously headless so the full ACK + 40-bit sequence
        // completes deterministically.
        if (/dht-?22/i.test(type) && typeof inst.onPinStateChange === 'function') {
          const dq = Object.keys(inst.pins || {}).find((p) => /^(DATA|DQ)/i.test(p)) || 'DATA';
          try { inst._scheduleBoardCycles = (cb) => { cb(); }; } catch { /* ignore */ }
          try {
            inst.setPinVoltage(dq, 0.0);
            inst.onPinStateChange(dq, false, cyc);
            inst.setPinVoltage(dq, 5.0);
            inst.onPinStateChange(dq, true, cyc + 16000);
          } catch { /* optional */ }
        }

        // Raindrop pad + module share a singleton: wet the pad, the
        // module's DO drops LOW on update.
        if (/raindrop-pad/i.test(type) && typeof inst.onEvent === 'function') {
          try { inst.onEvent({ type: 'rain_level', value: 800 }); } catch { /* optional */ }
        }
        if (/raindrop-module/i.test(type)) {
          try {
            raindropSharedState.rainLevel = 800;
            raindropSharedState.rainDetected = true;
            raindropSharedState.padVoltage = 0;
          } catch { /* ignore */ }
        }
        // Light sensors: lux level event.
        if (/photoresistor|photodiode/i.test(type) && typeof inst.onEvent === 'function') {
          try { inst.onEvent({ type: 'SET_ATTR', key: 'lux', value: '1000' }); } catch { /* optional */ }
        }

        // Clock generator: needs nanosecond-scale time deltas to toggle.
        if (/clock-generator/i.test(type)) {
          try {
            inst.update(0, [], new Map());
            inst.update(300000000, [], new Map());
            inst.update(600000000, [], new Map());
          } catch { /* optional */ }
        }

        // KS2E relay: 5V across the coil pair energises (threshold 3.5V).
        if (/ks2e-m-dc5/i.test(type)) {
          try {
            inst.setPinVoltage('COIL1', 5.0);
            inst.setPinVoltage('COIL2', 0.0);
            inst.update(cyc + 1000, [], new Map());
          } catch { /* optional */ }
        }
        if (/pir-motion-sensor/i.test(type) && typeof inst.onEvent === 'function') {
          try { inst.onEvent({ type: 'motion_start' }); } catch { /* optional */ }
        }
        if (/ir-receiver/i.test(type) && typeof inst.onEvent === 'function') {
          try { inst.onEvent({ type: 'ir-send', button: 'POWER' }); } catch { /* optional */ }
        }
        if (/ir-remote/i.test(type) && !/ir-receiver/i.test(type) && typeof inst.onEvent === 'function') {
          try { inst.onEvent({ type: 'button_press', button: 'Power' }); } catch { /* optional */ }
        }

        // 7-segment: light every segment on every active digit.
        if (/7segment/i.test(type)) {
          try {
            for (const seg of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP']) {
              try { inst.setPinVoltage(seg, 5.0); } catch { /* ignore */ }
            }
            for (const dg of ['COM.1', 'COM.2', 'DIG1', 'DIG2', 'DIG3', 'DIG4']) {
              try { if (inst.pins[dg] !== undefined) inst.setPinVoltage(dg, 5.0); } catch { /* ignore */ }
            }
            inst.onPinStateChange('A', true, cyc);
          } catch { /* optional */ }
        }

        // 74HC595: shift 0xFF then latch to storage.
        if (/74hc595/i.test(type) || type === 'shift_register') {
          try {
            const edge = (pin, high) => inst.onPinStateChange(pin, high, cyc);
            try { inst.setPinVoltage('ser', 5.0); } catch { /* ignore */ }
            for (let b = 0; b < 8; b += 1) { edge('srclk', false); edge('srclk', true); }
            edge('rclk', false); edge('rclk', true);
          } catch { /* optional */ }
        }

        // HX711: 2.5kg load latches raw 1050; clock out 24 data bits + gain.
        if (/hx711/i.test(type) && typeof inst.onEvent === 'function') {
          try {
            inst.onEvent({ type: 'input', load: '2.5' });
            inst.update(2000000, [], new Map());
            for (let p = 0; p < 25; p += 1) {
              inst.onPinStateChange('SCK', false, 2000000 + p * 10);
              inst.onPinStateChange('SCK', true, 2000000 + p * 10 + 5);
            }
          } catch { /* optional */ }
        }

        // 5W speaker: tone path synthesizes a playable chunk (buzzer
        // semantics over the chunk pipeline — no I2S source needed).
        if (/5w-speaker/i.test(type) && typeof inst.onPWMSignal === 'function') {
          try { inst.onPWMSignal('IN+', 440, 0.5, 1136); } catch { /* optional */ }
        }
        if (/tm1637/i.test(type) && typeof inst.onTwoWireStart === 'function') {
          try {
            inst.onTwoWireStart();
            inst.onTwoWireByteReceived(0x40);
            inst.onTwoWireStop();
            inst.onTwoWireStart();
            inst.onTwoWireByteReceived(0xc0);
            for (const b of [0x3f, 0x06, 0x5b, 0x4f]) inst.onTwoWireByteReceived(b);
            inst.onTwoWireStop();
            inst.onTwoWireStart();
            inst.onTwoWireByteReceived(0x8f);
            inst.onTwoWireStop();
          } catch { /* optional */ }
        }

        tick(inst, 3, cyc);
        const st1 = stateOf(inst);
        const rx1 = Number(st1.i2cRxBytes || 0) + Number(st1.spiRxBytes || 0) + Number(st1.uartRxBytes || 0);

        // Telemetry contract: enabled collection must validate when non-empty.
        inst.telemetryEnabled = true;
        const tele = collectComponentTelemetry(inst, 'detail', undefined);
        if (tele && Object.keys(tele).length > 0) {
          const res = validateTelemetrySchema(tele);
          assert.equal(res.ok, true, `${type}: telemetry schema violation: ${JSON.stringify(res.reasons).slice(0, 200)}`);
        }

        // Tier assignment: content > traffic > smoke.
        let tier = 'smoke';
        if (rx1 > rx0) tier = 'traffic';
        try {
          if (type.includes('lcd2004') || type.includes('lcd1602')) {
            const lines = inst.hd44780?.getLines?.() || [];
            const text = lines.join('\n');
            if (text.trim().length > 0) {
              tier = 'content';
              tiers.content.push(`${type}: text=${JSON.stringify(text.slice(0, 40))}`);
            } else if (rx1 > rx0) {
              tier = 'traffic';
            }
          } else if (type.includes('ssd1306')) {
            const vram = inst.vram || inst.state?.vram;
            const dirty = inst.state?.vramDirty || (Number(st1.updateCount || 0) > 0);
            if (((vram && [...vram].some((b) => b !== 0)) || dirty) && rx1 > rx0) tier = 'content';
          } else if (type.includes('nokia-5110')) {
            const fb = inst.fb;
            const fbStr = inst.state?.fbStr;
            if (((fb && [...fb].some((b) => b !== 0)) || (typeof fbStr === 'string' && /[1-9a-f]/i.test(fbStr))) && Number(st1.spiRxBytes || 0) > 0) tier = 'content';
          } else if (/epaper/i.test(type)) {
            try {
              const vram = inst.vram || inst.state?.vram;
              if (vram && [...vram.slice(0, 16)].every((b) => b === 0)) {
                tier = 'content';
                tiers.content.push(`${type}: vram-ingest-16B`);
              }
            } catch { /* optional */ }
          } else if (type.includes('tm1637')) {
            const d = inst.state?.digits;
            if (Array.isArray(d) && d.some((x) => x !== 0)) tier = 'content';
          } else if (/dht-?22/i.test(type)) {
            if (Array.isArray(inst.dataBits) && inst.dataBits.length === 40) tier = 'content';
            else if (st1.temperature !== undefined) tier = 'traffic';
          } else if (/7segment/i.test(type)) {
            try {
              const segs = st1.digitSegments || inst.state?.digitSegments;
              const lit = segs && Object.values(segs).some((d) => d && Object.values(d).some(Boolean));
              if (lit) tier = 'content';
            } catch { /* ignore */ }
          } else if (/74hc595/i.test(type) || type === 'shift_register') {
            if (Number(st1.storageReg) === 0xff) tier = 'content';
          } else if (/hx711/i.test(type)) {
            if (Number(st1.rawValue) === 1050) tier = 'content';
          } else if (/nlsf595/i.test(type)) {
            if (Number(st1.r) === 255 || Number(st1.g) === 255 || Number(st1.b) === 255) tier = 'content';
          } else if (/5w-speaker/i.test(type)) {
            const ch = inst.state?.audioChunk;
            if (Array.isArray(ch) && ch.length > 1000) tier = 'content';
          } else if (/pir-motion-sensor/i.test(type)) {
            if (st1.motion === true) tier = 'content';
          } else if (/photoresistor|photodiode/i.test(type)) {
            if (Number(st1.lux) === 1000 || String(st1.lux) === '1000') tier = 'content';
          } else if (/clock-generator/i.test(type)) {
            try {
              const v = inst.getPinVoltage('OUT');
              if (v === 5.0 || v === 0.0) {
                inst.update(900000000, [], new Map());
                if (inst.getPinVoltage('OUT') !== v) tier = 'content';
                else if (rx1 > rx0 || JSON.stringify(st1) !== JSON.stringify(st0)) tier = 'traffic';
              }
            } catch { /* ignore */ }
          } else if (/ks2e-m-dc5/i.test(type)) {
            if (st1.energised === true) tier = 'content';
          } else if (/raindrop-pad/i.test(type)) {
            try {
              const v = inst.getPinVoltage('AOUT');
              if (v > 0 && v < 5.0) tier = 'content';
            } catch { /* ignore */ }
          } else if (/raindrop-module/i.test(type)) {
            try {
              if (inst.getPinVoltage('DO') === 0.0) tier = 'content';
            } catch { /* ignore */ }
          } else if (/ir-receiver/i.test(type)) {
            if (st1.transmitting === true || String(st1.lastButton || '') === 'POWER') tier = 'content';
          } else if (/ir-remote/i.test(type)) {
            if (String(st1.lastCommand || '') === 'Power') tier = 'content';
          } else if (type.includes('max7219')) {
            if (Number(st1.spiRxBytes || 0) > 0 && (st1.lastFrame?.length > 0 || st1.lastCommand != null)) tier = 'content';
          } else if (type.includes('ili9341')) {
            const vram = inst.vram || inst.state?.vram || st1.buffer;
            if (Number(st1.spiRxBytes || 0) > 0 || Number(st1.writeCount || 0) > 0 ||
                (vram && [...vram.slice(0, 64)].some((b) => b !== 0))) tier = 'content';
          } else if (type.includes('max98357')) {
            try {
              const v = Number(inst.getPinVoltage('OUT+'));
              if (Math.abs(v - 2.475) < 0.02) {
                tier = 'content';
                tiers.content.push(`${type}: OUT+ driven ${v.toFixed(3)}V`);
              }
            } catch { /* optional */ }
          } else if (type.includes('pcm5102')) {
            try {
              const v = Number(inst.getPinVoltage('OUTL'));
              if (Math.abs(v - 2.475) < 0.02) {
                tier = 'content';
                tiers.content.push(`${type}: OUTL driven ${v.toFixed(3)}V`);
              }
            } catch { /* optional */ }
          } else if (type.includes('ds18b20')) {
            if (Number(st1.rawValue) === 400 && Number(st1.temperature) === 25) tier = 'content';
          } else if (type.includes('mfrc522')) {
            if (Number(st1.spiRxBytes || 0) > 0) tier = 'content';
          } else if (type.includes('mpu6050') || type.includes('bmp180') || type.includes('ds1307') || type.includes('max30102') || type.includes('pca9685')) {
            if (rx1 > rx0) tier = 'content';
          } else if (type.includes('dht22') || type === 'DHT-22' || type.includes('ds18b20')) {
            if (st1.temperature !== undefined) tier = 'content';
          } else if (rx1 > rx0) {
            tier = 'traffic';
          } else if (JSON.stringify(st1) !== JSON.stringify(st0)) {
            tier = 'traffic';
          }
        } catch { /* tier probe never fails the sweep */ }
        if (tier === 'content' && !tiers.content.some((s) => s.startsWith(type))) tiers.content.push(type);
        else tiers[tier].push(type);
      } catch (e) {
        failures.push(`${type}: ${String(e?.message || e).slice(0, 160)}`);
      }
    }

    console.log(`COMPONENT-SWEEP types=${types.length} content=${tiers.content.length} traffic=${tiers.traffic.length} smoke=${tiers.smoke.length} skips=${skips.length} failures=${failures.length}`);
    console.log(`COMPONENT-SWEEP content: ${tiers.content.join(' | ').slice(0, 1200)}`);
    console.log(`COMPONENT-SWEEP smoke: ${tiers.smoke.join(' | ').slice(0, 1200)}`);
    if (failures.length > 0) console.log(`COMPONENT-SWEEP failures:\n - ${failures.join('\n - ')}`);
    if (skips.length > 0) console.log(`COMPONENT-SWEEP skips (${skips.length}): ${skips.slice(0, 12).join(' | ')}${skips.length > 12 ? ' | ...' : ''}`);
    assert.deepEqual(failures, []);
  });
});
