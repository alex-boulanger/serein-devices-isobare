export interface RandomSource {
  next(): number;
  integer(min: number, max: number): number;
  pick<T>(values: readonly T[]): T;
}

export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    integer(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(values: readonly T[]): T {
      if (values.length === 0) {
        throw new Error("Cannot choose from an empty collection");
      }
      return values[Math.floor(next() * values.length)]!;
    },
  };
}

export function deriveSeed(seed: number, label: string): number {
  let hash = (seed ^ 0x811c9dc5) >>> 0;
  for (const character of label) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}
