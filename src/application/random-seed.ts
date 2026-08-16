export interface RandomSeedSource {
  fill(values: Uint32Array): void;
}

/**
 * Live's extension host exposes no Web Crypto, so the default source uses it
 * when present and mixes time and entropy otherwise. A generation seed only has
 * to spread across the 32-bit range and not repeat between dialogs; it is a
 * musical starting point, not a security value.
 */
const defaultSeedSource: RandomSeedSource = {
  fill(values) {
    const webCrypto = globalThis.crypto;
    if (typeof webCrypto?.getRandomValues === "function") {
      webCrypto.getRandomValues(values);
      return;
    }
    for (let index = 0; index < values.length; index += 1) {
      values[index] = mixEntropy(index);
    }
  },
};

let entropyCounter = 0;

function mixEntropy(index: number): number {
  entropyCounter = (entropyCounter + 1) >>> 0;
  let hash = (Date.now() ^ Math.imul(entropyCounter, 0x9e3779b1) ^ Math.imul(index, 0x85ebca6b)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x21f0aaad) >>> 0;
  hash = (hash ^ Math.floor(Math.random() * 0x1_0000_0000)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x735a2d97) >>> 0;
  return (hash ^ (hash >>> 15)) >>> 0;
}

export function createRandomSeed(
  excluding?: number,
  source: RandomSeedSource = defaultSeedSource,
): number {
  const values = new Uint32Array(1);
  source.fill(values);
  const candidate = values[0]!;
  return candidate === excluding ? (candidate + 1) >>> 0 : candidate;
}
