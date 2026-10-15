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

// One CS-asserted command transaction + documented read clocks, like
// SD.begin does. Command-phase clocks MUST read back idle-high (0xFF)
// without consuming queued responses; the R1/R3/R7 surfaces on the
// following read clocks (R1: 1 byte, R7: 5 bytes — fully drained).
function cmd(sd, n, arg, crc, readLen) {
  sd.onPinStateChange('CS', false, 1);
  const during = [];
  for (const b of [0x40 | n, ...arg, crc]) during.push(sd.onSPIByte(b));
  assert.deepEqual(during, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
  const resp = [];
  for (let i = 0; i < readLen; i += 1) resp.push(sd.onSPIByte(0xff));
  sd.onPinStateChange('CS', true, 2);
  return resp;
}

describe('SD card SPI init (Arduino SD.begin compatible)', () => {
  test('CMD0/CMD8/ACMD41/CMD58 handshake with ready OCR', () => {
    const sd = makeSD();
    const r0 = cmd(sd, 0, [0, 0, 0, 0], 0x95, 1);
    assert.deepEqual(r0, [0x01]);
    const r8 = cmd(sd, 8, [0, 0, 0x01, 0xaa], 0x87, 5);
    assert.deepEqual(r8, [0x01, 0x00, 0x00, 0x01, 0xaa]);
    cmd(sd, 55, [0, 0, 0, 0], 0x65, 1);
    const r41 = cmd(sd, 41, [0x40, 0, 0, 0], 0x77, 1);
    assert.deepEqual(r41, [0x00]);
    const r58 = cmd(sd, 58, [0, 0, 0, 0], 0xfd, 5);
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
    // MBR: FAT16 partition + boot signature. Boot indicator must be
    // 0x00 (Arduino rejects anything else as "not a valid partition").
    assert.equal(mem[446 + 4], 0x06);
    assert.equal(mem[446], 0x00);
    assert.equal(mem[510], 0x55);
    assert.equal(mem[511], 0xaa);
    // PBR at LBA 1: bytes/sector 512, signature, and a cluster count in
    // genuine FAT16 range (>= 4085) so Arduino SD mounts it.
    const pbr = 512;
    assert.equal(mem[pbr + 11] | (mem[pbr + 12] << 8), 512);
    const spc = mem[pbr + 13];
    assert.ok(spc >= 1 && spc <= 64);
    const fatSectors = mem[pbr + 22] | (mem[pbr + 23] << 8);
    const rootSectors = 32;
    const total = mem.length / 512;
    const clusters = Math.floor((total - 1 - rootSectors - 2 * fatSectors) / spc);
    assert.ok(clusters >= 4085 && clusters <= 65525, `clusters=${clusters} not FAT16 range`);
    assert.equal(mem[pbr + 510], 0x55);
    assert.equal(mem[pbr + 511], 0xaa);
    // FAT1: media + EOF chain, README owns cluster 2.
    const fat = 2 * 512;
    assert.equal(mem[fat], 0xf8);
    assert.equal(mem[fat + 4] | (mem[fat + 5] << 8), 0xffff);
    // Root entry: README.TXT at cluster 2 with content in data area
    // (region bases derived from the BPB, like a real FAT driver).
    const root = (2 + 2 * fatSectors) * 512;
    assert.equal(String.fromCharCode(...mem.slice(root, root + 11)), 'README  TXT');
    assert.equal(mem[root + 26] | (mem[root + 27] << 8), 2);
    const size = (mem[root + 28] | (mem[root + 29] << 8) | (mem[root + 30] << 16) | (mem[root + 31] << 24)) >>> 0;
    assert.ok(size > 0);
    const data = (2 + 2 * fatSectors + rootSectors) * 512;
    assert.equal(String.fromCharCode(...mem.slice(data, data + 6)), 'OpenHW');
  });
});
