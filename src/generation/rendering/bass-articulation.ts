import { interpolate, resolveCount } from "../macros";
import { dynamicOffset } from "./note-mechanics";
import { createRandom, deriveSeed, type RandomSource } from "../random";
import {
  type BassArticulationFamily,
  type GeneratedNote,
  type SceneKind,
} from "../types";

export interface BassArticulationEvent {
  readonly beat: number;
  readonly duration: number;
  readonly velocity: number;
}

/**
 * Attacks per Scene Cycle from lowest to highest Motion. Development and
 * Tension keep a floor of two and three so they still carry activity through
 * the whole cycle at rest, per ADR 0012.
 */
const ATTACK_RANGES: Readonly<Record<SceneKind, readonly [number, number]>> = {
  foundation: [1, 3],
  development: [2, 7],
  tension: [3, 7],
  release: [1, 4],
};

/**
 * How each family spaces its attacks. Generating the candidate beats from a gap
 * character rather than a hardcoded array of positions lets every seed phrase
 * the family differently while it stays recognisably itself; the entrance,
 * which is what ADR 0012 actually defines a family by, is unchanged.
 */
const FAMILY_ATTACKS = 7;
const FAMILY_SPACING: Readonly<Record<BassArticulationFamily, {
  readonly gap: readonly [number, number];
  readonly tightens: boolean;
}>> = {
  pedal: { gap: [4, 6], tightens: false },
  breath: { gap: [4, 6], tightens: false },
  call: { gap: [3, 6], tightens: false },
  drift: { gap: [3, 7], tightens: false },
  pickup: { gap: [3, 6], tightens: true },
};

const GATE_RATIO: Readonly<Record<BassArticulationFamily, number>> = {
  pedal: 0.9,
  breath: 0.55,
  call: 0.38,
  drift: 0.72,
  pickup: 0.42,
};

export function createBassArticulation(
  seed: number,
  family: BassArticulationFamily,
  scene: SceneKind,
  motion: number,
  space: number,
  densityScale: number,
  earliestBeat: number,
): BassArticulationEvent[] {
  const motifRandom = createRandom(deriveSeed(seed, `bass-articulation:${family}`));
  const sceneRandom = createRandom(deriveSeed(seed, `bass-articulation:${family}:${scene}`));
  const [minimum, maximum] = ATTACK_RANGES[scene];
  const desired = resolveCount(minimum, maximum, motion, seed, `bass-attacks:${scene}`);
  const count = clamp(Math.round(desired * densityScale), minimum, maximum);
  const candidates = transformForScene(
    createFamilyBeats(family, motifRandom),
    scene,
    sceneRandom.pick([-1, 0, 1]),
  );
  const beats = withEntranceFloor(
    selectForScene(candidates, count, scene, sceneRandom),
    earliestBeat,
  );
  const sceneGateOffset: Readonly<Record<SceneKind, number>> = {
    foundation: -0.25,
    development: 0.15,
    tension: 0.08,
    release: -0.2,
  };
  // Space shortens the gate so the low end stops filling every bar.
  const ratio = clamp(
    GATE_RATIO[family] + sceneGateOffset[scene] + interpolate(0.12, -0.2, space),
    0.22,
    0.95,
  );

  return beats.map((beat, index) => {
    const nextBeat = beats[index + 1] ?? 32;
    const available = Math.max(0.75, nextBeat - beat);
    const duration = Math.min(
      Math.max(0.75, roundHalf(available * ratio)),
      Math.max(0.75, 31 - beat),
    );
    const phraseAccent = index === 0 ? 7 : index === beats.length - 1 ? 3 : 0;
    const sceneAccent = scene === "tension" ? 4 : scene === "release" ? -4 : 0;
    return {
      beat,
      duration,
      velocity: Math.round(clamp(
        70 + phraseAccent + sceneAccent + dynamicOffset(scene, beat)
          + sceneRandom.integer(-3, 3),
        54,
        96,
      )),
    };
  });
}

/**
 * Pushes the phrase's first attack past the downbeat when another lane owns it,
 * without disturbing the attacks that follow.
 */
function withEntranceFloor(beats: readonly number[], earliest: number): number[] {
  const first = beats[0];
  if (first === undefined || first >= earliest) return [...beats];
  const ceiling = (beats[1] ?? 32) - 1;
  return [Math.max(0, Math.min(earliest, ceiling)), ...beats.slice(1)];
}

export function mergeContiguousBassNotes(notes: readonly GeneratedNote[]): GeneratedNote[] {
  const merged: GeneratedNote[] = [];
  for (const note of notes) {
    const previous = merged[merged.length - 1];
    if (
      previous !== undefined &&
      previous.pitch === note.pitch &&
      previous.startTime + previous.duration === note.startTime
    ) {
      merged[merged.length - 1] = {
        ...previous,
        duration: previous.duration + note.duration,
      };
    } else {
      merged.push(note);
    }
  }
  return merged;
}

function createFamilyBeats(
  family: BassArticulationFamily,
  random: RandomSource,
): number[] {
  const entrance = (() => {
    switch (family) {
      case "pedal": return random.pick([0, 0, 0, 1]);
      case "breath": return random.integer(1, 4);
      case "call": return random.pick([0, 0, 0, 1]);
      case "drift": return random.integer(2, 5);
      case "pickup": return random.integer(4, 8);
    }
  })();
  const { gap, tightens } = FAMILY_SPACING[family];
  const result = [entrance];

  for (let index = 1; index < FAMILY_ATTACKS; index += 1) {
    const remaining = FAMILY_ATTACKS - index - 1;
    // A tail pickup accelerates: its gaps close as the phrase runs on.
    const widest = tightens ? Math.max(gap[0], gap[1] - index) : gap[1];
    result.push(clamp(
      result[index - 1]! + random.integer(gap[0], widest),
      result[index - 1]! + 2,
      30 - remaining * 2,
    ));
  }
  return result;
}

function transformForScene(
  beats: readonly number[],
  scene: SceneKind,
  displacement: number,
): number[] {
  return unique(beats.map((beat, index) => {
    switch (scene) {
      case "foundation": return beat;
      case "development": return clamp(
        beat + displacement * (index % 2 === 0 ? 1 : -1),
        0,
        30,
      );
      case "tension": return clamp(
        roundHalf(beat + displacement * (index % 3 === 0 ? 1 : -0.5)),
        0,
        30,
      );
      case "release": return clamp(roundHalf(beat * 1.04), 0, 30);
    }
  })).sort((left, right) => left - right);
}

function selectForScene(
  values: readonly number[],
  count: number,
  scene: SceneKind,
  random: RandomSource,
): number[] {
  if (count >= values.length) return [...values];
  if (scene === "development" || scene === "tension") {
    return selectEvenly(values, count);
  }
  if (count === 1) {
    if (scene === "release" && random.next() < 0.55) {
      return [values.at(-1)!];
    }
    if (scene === "foundation") {
      return random.next() < 0.75
        ? [values[0]!]
        : [random.pick(values.slice(1, -1))];
    }
    return [random.pick(values.slice(0, -1))];
  }

  const firstIndex = scene === "foundation" && random.next() < 0.35
    ? Math.min(1, values.length - 2)
    : 0;
  const includeTail = scene === "release" || random.next() < 0.45;
  const lastIndex = includeTail
    ? values.length - 1
    : random.integer(firstIndex + 1, values.length - 2);
  const selected = [values[firstIndex]!, values[lastIndex]!];
  while (selected.length < count) {
    const candidate = random.pick(values);
    if (!selected.includes(candidate)) selected.push(candidate);
  }
  return selected.sort((left, right) => left - right);
}

function selectEvenly(values: readonly number[], count: number): number[] {
  if (count <= 1) return [values[0]!];
  const selected = Array.from({ length: count }, (_, index) =>
    values[Math.round(index * (values.length - 1) / (count - 1))]!,
  );
  return unique(selected);
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
