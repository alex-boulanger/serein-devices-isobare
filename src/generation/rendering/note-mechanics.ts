import { CLIP_LENGTH_BEATS } from "../planning/composition-plan";
import type {
  GeneratedNote,
  GenerationRecipe,
  HarmonicPath,
  MusicalRole,
  SceneKind,
} from "../types";
import type { RenderedRole } from "./types";

const VELOCITY: Readonly<Record<MusicalRole, number>> = {
  bass: 76,
  pad: 68,
  drone: 62,
  "arp-source": 72,
};

const MUTATION_RANGES: Readonly<
  Record<MusicalRole, Readonly<Record<SceneKind, readonly [number, number]>>>
> = {
  bass: {
    foundation: [0, 1], development: [1, 2], tension: [1, 2], release: [0, 1],
  },
  pad: {
    foundation: [1, 2], development: [2, 3], tension: [2, 4], release: [1, 2],
  },
  drone: {
    foundation: [0, 0], development: [0, 1], tension: [1, 1], release: [0, 0],
  },
  "arp-source": {
    foundation: [0, 1], development: [1, 2], tension: [1, 3], release: [0, 1],
  },
};

export function mutationBudget(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: MusicalRole,
): number {
  const [minimum, maximum] = MUTATION_RANGES[role][scene];
  if (recipe.parameters.motion < 1 / 3) return minimum;
  if (recipe.parameters.motion > 2 / 3) return maximum;
  return Math.round((minimum + maximum) / 2);
}

export function selectPathEvents(
  path: HarmonicPath,
  mutationCount: number,
): HarmonicPath["events"] {
  const mutations = path.events.slice(1);
  if (mutationCount <= 0 || mutations.length === 0) return [path.events[0]!];
  const count = Math.min(mutationCount, mutations.length);
  const selected = Array.from({ length: count }, (_, index) => {
    const mutationIndex = Math.floor(((index + 1) * mutations.length) / (count + 1));
    return mutations[Math.min(mutationIndex, mutations.length - 1)]!;
  });
  return [path.events[0]!, ...uniqueEvents(selected)];
}

export function renderMonophonicSegments(
  beats: readonly number[],
  pitches: readonly number[],
  role: "drone",
): RenderedRole {
  const notes: GeneratedNote[] = [];
  let mutationCount = 0;
  let pitch = pitches[0]!;
  let startTime = beats[0] ?? 0;

  for (let index = 1; index < beats.length; index += 1) {
    const nextPitch = pitches[index]!;
    if (nextPitch === pitch) continue;
    notes.push(createNote(pitch, startTime, beats[index]! - startTime, role));
    pitch = nextPitch;
    startTime = beats[index]!;
    mutationCount += 1;
  }
  notes.push(createNote(pitch, startTime, CLIP_LENGTH_BEATS - startTime, role));
  return { notes, mutationCount, densityChangeCount: 0 };
}

export function latestAt<T extends { readonly beat: number }>(
  events: readonly T[],
  beat: number,
): T {
  return events.reduce(
    (latest, event) => event.beat <= beat ? event : latest,
    events[0]!,
  );
}

export function pitchForClassNear(
  pitchClass: number,
  target: number,
  minimum: number,
  maximum: number,
): number {
  const candidates: number[] = [];
  for (let pitch = minimum; pitch <= maximum; pitch += 1) {
    if (pitch % 12 === pitchClass) candidates.push(pitch);
  }
  return candidates.reduce(
    (best, pitch) => Math.abs(pitch - target) < Math.abs(best - target) ? pitch : best,
    candidates[0] ?? minimum,
  );
}

export function createNote(
  pitch: number,
  startTime: number,
  duration: number,
  role: MusicalRole,
): GeneratedNote {
  return { pitch, startTime, duration, velocity: VELOCITY[role] };
}

export function transposeIntoMidiRange(pitch: number, offset: number): number {
  let shifted = pitch + offset;
  while (shifted < 0) shifted += 12;
  while (shifted > 127) shifted -= 12;
  return shifted;
}

function uniqueEvents<T extends { readonly beat: number }>(values: readonly T[]): T[] {
  const seen = new Set<number>();
  return values.filter((value) => {
    if (seen.has(value.beat)) return false;
    seen.add(value.beat);
    return true;
  });
}
