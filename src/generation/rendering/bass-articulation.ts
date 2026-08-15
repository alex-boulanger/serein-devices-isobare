import { createRandom, deriveSeed } from "../random";
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

const ATTACK_RANGES: Readonly<Record<SceneKind, readonly [number, number]>> = {
  foundation: [1, 2],
  development: [2, 4],
  tension: [2, 5],
  release: [1, 3],
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
  densityScale: number,
): BassArticulationEvent[] {
  const random = createRandom(deriveSeed(seed, `bass-articulation:${family}:${scene}`));
  const [minimum, maximum] = ATTACK_RANGES[scene];
  const desired = minimum + Math.round((maximum - minimum) * motion);
  const count = clamp(Math.round(desired * densityScale), minimum, maximum);
  const candidates = transformForScene(
    createFamilyBeats(family, random.integer(0, 3)),
    scene,
    random.pick([-1, 0, 1]),
  );
  const beats = selectEvenly(candidates, count);
  const ratio = clamp(
    GATE_RATIO[family] + (scene === "release" ? 0.1 : scene === "tension" ? -0.08 : 0),
    0.25,
    0.94,
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
      velocity: clamp(70 + phraseAccent + sceneAccent + random.integer(-3, 3), 54, 88),
    };
  });
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
  variation: number,
): number[] {
  switch (family) {
    case "pedal": return [0, 14 + variation, 25 + Math.floor(variation / 2), 29];
    case "breath": return [0, 8 + variation, 18 + variation, 27, 30];
    case "call": return [0, 4 + variation, 10 + variation, 20 + variation, 28];
    case "drift": return [0, 7 + variation, 15 + variation, 23 + variation, 29];
    case "pickup": return [0, 13 + variation, 22 + variation, 27 + variation, 30];
  }
}

function transformForScene(
  beats: readonly number[],
  scene: SceneKind,
  displacement: number,
): number[] {
  return unique(beats.map((beat, index) => {
    if (beat === 0) return 0;
    switch (scene) {
      case "foundation": return beat;
      case "development": return clamp(beat + displacement * (index % 2 === 0 ? 1 : -1), 1, 30);
      case "tension": return clamp(roundHalf(beat * 0.82 + index), 1, 30);
      case "release": return clamp(roundHalf(beat * 1.06), 1, 30);
    }
  })).sort((left, right) => left - right);
}

function selectEvenly(values: readonly number[], count: number): number[] {
  if (count <= 1) return [0];
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
