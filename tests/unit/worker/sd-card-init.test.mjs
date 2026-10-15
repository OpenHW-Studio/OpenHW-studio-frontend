import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { SDCardLogic } from '../../../src/worker/protocol-handlers/sd-card.ts';

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

  test('storage carries a mountable FAT16 volume with README', () => {
    const sd = makeSD();
    const mem = sd.storage;
    // MBR: FAT16 partition + boot signature.
    assert.equal(mem[446 + 4], 0x06);
    assert.equal(mem[510], 0x55);
    assert.equal(mem[511], 0xaa);
    // PBR at LBA 1: bytes/sector 512, 8 spc, 2 FATs, signature.
    const pbr = 512;
    assert.equal(mem[pbr + 11] | (mem[pbr + 12] << 8), 512);
    assert.equal(mem[pbr + 13], 8);
    assert.equal(mem[pbr + 16], 2);
    assert.equal(mem[pbr + 510], 0x55);
    assert.equal(mem[pbr + 511], 0xaa);
    // FAT1: media + EOF chain, README owns cluster 2.
    const fat = 2 * 512;
    assert.equal(mem[fat], 0xf8);
    assert.equal(mem[fat + 4] | (mem[fat + 5] << 8), 0xffff);
    // Root entry: README.TXT at cluster 2 with content in data area.
    const root = 6 * 512;
    assert.equal(String.fromCharCode(...mem.slice(root, root + 11)), 'README  TXT');
    assert.equal(mem[root + 26] | (mem[root + 27] << 8), 2);
    const size = (mem[root + 28] | (mem[root + 29] << 8) | (mem[root + 30] << 16) | (mem[root + 31] << 24)) >>> 0;
    assert.ok(size > 0);
    const data = (6 + 32) * 512;
    assert.equal(String.fromCharCode(...mem.slice(data, data + 6)), 'OpenHW');
  });
});
