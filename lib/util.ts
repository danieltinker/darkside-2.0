// Deterministic pseudo-sha256 hex for mock checksums and artifact digests.
// Browser- and server-safe (no node:crypto), stable across reloads.

function cyrb(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0);
}

// 64 hex chars (8 × 8) — sha256-shaped, deterministic for a given input.
export function checksumHex(input: string): string {
  let out = "";
  for (let seed = 0; seed < 8; seed++) {
    out += cyrb(input, seed).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

export function shortHex(input: string, len = 12): string {
  return checksumHex(input).slice(0, len);
}
