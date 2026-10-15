import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { SDCardLogic } from '@openhw/emulator/src/protocol-handlers/sd-card';

function makeSD() {
  const sd = new SDCardLogic('sd1', {
    type: 'openhw-sd-card', attrs: {},
    pins: [{ id: 'CD' }, { id: 'MISO' }, { id: 'GND' }, { id: 'SCK' }, { id: 'VCC' }, { id: 'MOSI' }, { id: 'CS' }],
  });
  sd.setPinVoltage('VCC', 5.0);
  sd.setPinVoltage('GND', 0.0);
  return sd;
}

// One CS-asserted command transaction + two read clocks, like SD.begin does.
function cmd(sd, n, arg, crc) {
  sd.onPinStateChange('CS', false, 1);
  const resp = [];
  for (const b of [0x40 | n, ...arg, crc]) resp.push(sd.onSPIByte(b));
  resp.push(sd.onSPIByte(0xff));
  resp.push(sd.onSPIByte(0xff));
  sd.onPinStateChange('CS', true, 2);
  return resp;
}

describe('SD card SPI init (Arduino SD.begin compatible)', () => {
  test('CMD0/CMD8/ACMD41/CMD58 handshake with ready OCR', () => {
    const sd = makeSD();
    const r0 = cmd(sd, 0, [0, 0, 0, 0], 0x95);
    assert.ok(r0.includes(0x01), `CMD0 must return idle 0x01, got ${JSON.stringify(r0)}`);
    const r8 = cmd(sd, 8, [0, 0, 0x01, 0xaa], 0x87);
    assert.ok(r8.includes(0x01), `CMD8 must return 0x01, got ${JSON.stringify(r8)}`);
    cmd(sd, 55, [0, 0, 0, 0], 0x65);
    const r41 = cmd(sd, 41, [0x40, 0, 0, 0], 0x77);
    assert.ok(r41.includes(0x00), `ACMD41 must return ready 0x00, got ${JSON.stringify(r41)}`);
    const r58 = cmd(sd, 58, [0, 0, 0, 0], 0xfd);
    // R1=0x00 then OCR with power-up complete (bit31) + CCS (bit30).
    const i = r58.indexOf(0x00);
    assert.ok(i >= 0, `CMD58 must return 0x00, got ${JSON.stringify(r58)}`);
    const ocr = ((r58[i + 1] << 24) | (r58[i + 2] << 16) | (r58[i + 3] << 8) | r58[i + 4]) >>> 0;
    assert.ok((ocr & 0x80000000) !== 0, `OCR must show power-up complete, got 0x${ocr.toString(16)}`);
    assert.ok((ocr & 0x40000000) !== 0, `OCR must show CCS/SDHC, got 0x${ocr.toString(16)}`);
  });
});
