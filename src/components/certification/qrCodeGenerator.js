/**
 * Lightweight zero-dependency QR Code generator (ISO/IEC 18004, Byte mode, ECC Level M).
 * Supports Versions 1–6 (up to 106 UTF-8 bytes), covering certificate verification URLs.
 */

// ECC Level M specification per version (1..6):
// [maxBytes, totalDataCodewords, ecCodewordsPerBlock, group1Blocks, group1Data, group2Blocks, group2Data, alignmentCoords]
const VERSION_SPECS = [
  null,
  [14, 16, 10, 1, 16, 0, 0, []],
  [26, 28, 16, 1, 28, 0, 0, [6, 18]],
  [42, 44, 26, 1, 44, 0, 0, [6, 22]],
  [62, 64, 18, 2, 32, 0, 0, [6, 26]],
  [84, 86, 24, 2, 43, 0, 0, [6, 30]],
  [106, 108, 16, 4, 27, 0, 0, [6, 34]],
];

// GF(256) with primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11d)
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function getGeneratorPoly(ecCount) {
  let poly = [1];
  for (let i = 0; i < ecCount; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function computeEcCodewords(data, ecCount) {
  const gen = getGeneratorPoly(ecCount);
  const res = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecCount - 1] = 0;
    for (let j = 0; j < ecCount; j++) {
      res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return Array.from(res);
}

function encodeDataCodewords(bytes, spec) {
  const [, totalData, , g1Blocks, g1Data, g2Blocks, g2Data] = spec;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Mode indicator 0100 (Byte), 8-bit character count (Versions 1–9)
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (const b of bytes) pushBits(b, 8);

  const totalBits = totalData * 8;
  const termLen = Math.min(4, totalBits - bits.length);
  pushBits(0, termLen);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  const padBytes = [0xec, 0x11];
  for (let p = 0; codewords.length < totalData; p++) {
    codewords.push(padBytes[p % 2]);
  }

  // Split into blocks and interleave data + EC codewords
  const ecCount = spec[2];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i++) {
    const block = codewords.slice(offset, offset + g1Data);
    offset += g1Data;
    dataBlocks.push(block);
    ecBlocks.push(computeEcCodewords(block, ecCount));
  }
  for (let i = 0; i < g2Blocks; i++) {
    const block = codewords.slice(offset, offset + g2Data);
    offset += g2Data;
    dataBlocks.push(block);
    ecBlocks.push(computeEcCodewords(block, ecCount));
  }

  const finalCodewords = [];
  const maxDataLen = Math.max(g1Data, g2Data);
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) finalCodewords.push(block[i]);
    }
  }
  for (let i = 0; i < ecCount; i++) {
    for (const ec of ecBlocks) {
      finalCodewords.push(ec[i]);
    }
  }
  return finalCodewords;
}

function buildFunctionGrid(version, alignCoords) {
  const size = version * 4 + 17;
  const grid = Array.from({ length: size }, () => new Int8Array(size).fill(-1));
  const reserved = Array.from({ length: size }, () => new Uint8Array(size));

  const setFixed = (r, c, dark) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      grid[r][c] = dark ? 1 : 0;
      reserved[r][c] = 1;
    }
  };

  const placeFinder = (top, left) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark =
          inOuter &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFixed(rr, cc, dark);
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFixed(6, i, i % 2 === 0);
    setFixed(i, 6, i % 2 === 0);
  }

  for (const ar of alignCoords) {
    for (const ac of alignCoords) {
      if (reserved[ar][ac]) continue;
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const dark = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
          setFixed(ar + r, ac + c, dark);
        }
      }
    }
  }

  // Reserve format info cells and set dark module
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = 1;
      reserved[i][8] = 1;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = 1;
    reserved[size - 1 - i][8] = 1;
  }
  setFixed(4 * version + 9, 8, true);

  return { size, grid, reserved };
}

function getFormatBits(maskIdx) {
  // ECC Level M = 00 -> 5-bit data = (00 << 3) | maskIdx
  const data = maskIdx & 0x7;
  let rem = data << 10;
  const gen = 0x537;
  for (let i = 4; i >= 0; i--) {
    if ((rem >> (i + 10)) & 1) rem ^= gen << i;
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function applyFormatAndMask(baseGrid, reserved, size, maskIdx) {
  const m = baseGrid.map((row) => Int8Array.from(row));
  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ][maskIdx];

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!reserved[r][c] && maskFn(r, c)) {
        m[r][c] ^= 1;
      }
    }
  }

  const fmt = getFormatBits(maskIdx);
  for (let i = 0; i < 15; i++) {
    const bit = (fmt >> i) & 1;
    // Strip 1
    if (i < 6) m[i][8] = bit;
    else if (i < 8) m[i + 1][8] = bit;
    else m[size - 15 + i][8] = bit;
    // Strip 2
    if (i < 8) m[8][size - 1 - i] = bit;
    else if (i < 9) m[8][15 - i] = bit;
    else m[8][14 - i] = bit;
  }
  return m;
}

function scoreMatrix(m, size) {
  let penalty = 0;
  // Rule 1: 5+ consecutive same-color modules
  for (let r = 0; r < size; r++) {
    let runR = 1;
    let runC = 1;
    for (let i = 1; i < size; i++) {
      if (m[r][i] === m[r][i - 1]) runR++;
      else {
        if (runR >= 5) penalty += 3 + (runR - 5);
        runR = 1;
      }
      if (m[i][r] === m[i - 1][r]) runC++;
      else {
        if (runC >= 5) penalty += 3 + (runC - 5);
        runC = 1;
      }
    }
    if (runR >= 5) penalty += 3 + (runR - 5);
    if (runC >= 5) penalty += 3 + (runC - 5);
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }
  // Rule 3: finder-like 1:1:3:1:1 patterns
  const matchPat = (arr, start, pat) => pat.every((v, idx) => arr[start + idx] === v);
  const pA = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const pB = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const col = new Int8Array(size);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      if (matchPat(m[r], c, pA) || matchPat(m[r], c, pB)) penalty += 40;
    }
    for (let c = 0; c < size; c++) col[c] = m[c][r];
    for (let c = 0; c <= size - 11; c++) {
      if (matchPat(col, c, pA) || matchPat(col, c, pB)) penalty += 40;
    }
  }
  // Rule 4: dark module balance
  let dark = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) dark += m[r][c];
  }
  const k = Math.abs(Math.ceil((dark * 100) / (size * size) / 5) - 10);
  penalty += k * 10;
  return penalty;
}

/**
 * Generates a QR Code boolean matrix (rows of 0/1) for the input string.
 */
export function createQrMatrix(text) {
  const bytes = new TextEncoder().encode(String(text));
  let version = 1;
  while (version < VERSION_SPECS.length && bytes.length > VERSION_SPECS[version][0]) {
    version++;
  }
  if (version >= VERSION_SPECS.length) {
    throw new Error(`QR payload too long (${bytes.length} bytes, max 106)`);
  }

  const spec = VERSION_SPECS[version];
  const codewords = encodeDataCodewords(bytes, spec);
  const { size, grid, reserved } = buildFunctionGrid(version, spec[7]);

  // Place data bits in zig-zag columns right-to-left
  const dataBits = [];
  for (const cw of codewords) {
    for (let b = 7; b >= 0; b--) dataBits.push((cw >> b) & 1);
  }
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const r = upward ? size - 1 - step : step;
      for (let dc = 0; dc < 2; dc++) {
        const c = col - dc;
        if (!reserved[r][c]) {
          grid[r][c] = bitIdx < dataBits.length ? dataBits[bitIdx++] : 0;
        }
      }
    }
    upward = !upward;
  }

  let bestMask = null;
  let bestScore = Infinity;
  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const candidate = applyFormatAndMask(grid, reserved, size, maskIdx);
    const sc = scoreMatrix(candidate, size);
    if (sc < bestScore) {
      bestScore = sc;
      bestMask = candidate;
    }
  }
  return bestMask;
}

/**
 * Generates a PNG data URL for a QR code matching `QRCode.toDataURL` options.
 */
export function generateQrDataUrl(text, { width = 180, margin = 1, dark = '#000000', light = '#ffffff' } = {}) {
  const matrix = createQrMatrix(text);
  const size = matrix.length;
  const totalModules = size + margin * 2;
  const scale = Math.max(1, Math.floor(width / totalModules));
  const pxSize = totalModules * scale;

  const canvas = document.createElement('canvas');
  canvas.width = pxSize;
  canvas.height = pxSize;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, pxSize, pxSize);
  ctx.fillStyle = dark;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c]) {
        ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
      }
    }
  }
  return canvas.toDataURL('image/png');
}
