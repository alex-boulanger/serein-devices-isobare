import { describe, expect, it } from "bun:test";

import { createRandomSeed } from "../../src/application/random-seed";

describe("createRandomSeed", () => {
  it("uses the complete unsigned 32-bit seed range", () => {
    expect(createRandomSeed(undefined, fixedSource(0xffff_ffff))).toBe(0xffff_ffff);
    expect(createRandomSeed(undefined, fixedSource(0))).toBe(0);
  });

  it("does not return the currently displayed seed when randomizing", () => {
    expect(createRandomSeed(0xffff_ffff, fixedSource(0xffff_ffff))).toBe(0);
    expect(createRandomSeed(42, fixedSource(42))).toBe(43);
  });

  it("still produces a seed where the host exposes no Web Crypto", () => {
    withoutWebCrypto(() => {
      const seeds = Array.from({ length: 64 }, () => createRandomSeed());

      for (const seed of seeds) {
        expect(Number.isInteger(seed)).toBe(true);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(seed).toBeLessThanOrEqual(0xffff_ffff);
      }
      // Consecutive dialogs must not open on the same seed.
      expect(new Set(seeds).size).toBeGreaterThan(seeds.length * 0.9);
    });
  });

  it("spreads fallback seeds across the whole 32-bit range", () => {
    withoutWebCrypto(() => {
      const seeds = Array.from({ length: 256 }, () => createRandomSeed());
      const high = seeds.filter((seed) => seed > 0x8000_0000).length;

      expect(high).toBeGreaterThan(60);
      expect(high).toBeLessThan(196);
    });
  });
});

/** Reproduces Live's extension host, where `globalThis.crypto` is undefined. */
function withoutWebCrypto(run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    value: undefined,
    configurable: true,
    writable: true,
  });
  try {
    run();
  } finally {
    if (descriptor === undefined) {
      Reflect.deleteProperty(globalThis, "crypto");
    } else {
      Object.defineProperty(globalThis, "crypto", descriptor);
    }
  }
}

function fixedSource(value: number) {
  return {
    fill(values: Uint32Array) {
      values[0] = value;
    },
  };
}
