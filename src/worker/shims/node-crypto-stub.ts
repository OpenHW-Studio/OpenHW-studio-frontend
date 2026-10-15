// Browser stub for node:crypto.
//
// Only used by esp32-emu's partition-table MD5 (custom CSV partitions),
// which never runs in the browser (default merged-bin boot). Throws lazily
// so module load succeeds; the custom-CSV path fails loudly if hit.
export function createHash(..._a: any[]): never {
  throw new Error(
    'partition-table MD5 needs node:crypto (custom CSV partitions unsupported in browser)',
  );
}

export function randomBytes(_n: number): Uint8Array {
  const out = new Uint8Array(_n);
  try {
    crypto.getRandomValues(out);
  } catch {
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 256) | 0;
  }
  return out;
}

export default { createHash, randomBytes };
