import { CLIP_LENGTH_BEATS } from "../planning/composition-plan";
import { interpolate, macroUnit, resolveCount } from "../macros";
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
  lead: 78,
};

/**
 * Motion sweeps each role from its quietest to its busiest reading of a Scene.
 * The spans are deliberately wide: a narrow span makes the macro inaudible no
 * matter how precisely it is resolved.
 */
const MUTATION_RANGES: Readonly<
  Record<MusicalRole, Readonly<Record<SceneKind, readonly [number, number]>>>
> = {
  bass: {
    foundation: [0, 2], development: [1, 4], tension: [1, 5], release: [0, 2],
  },
  pad: {
    foundation: [1, 3], development: [2, 5], tension: [2, 6], release: [1, 3],
  },
  drone: {
    foundation: [0, 1], development: [0, 2], tension: [1, 3], release: [0, 1],
  },
  "arp-source": {
    foundation: [0, 2], development: [1, 4], tension: [1, 5], release: [0, 2],
  },
  lead: {
    foundation: [0, 1], development: [2, 3], tension: [3, 4], release: [1, 2],
  },
};

export function mutationBudget(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: MusicalRole,
): number {
  const [minimum, maximum] = MUTATION_RANGES[role][scene];
  return resolveCount(
    minimum,
    maximum,
    recipe.parameters.motion,
    recipe.seed,
    `mutation:${role}:${scene}`,
  );
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
  scene: SceneKind,
): RenderedRole {
  const notes: GeneratedNote[] = [];
  const velocityAt = (beat: number) =>
    clampVelocity(VELOCITY[role] + dynamicOffset(scene, beat));
  let mutationCount = 0;
  let pitch = pitches[0]!;
  let startTime = beats[0] ?? 0;

  for (let index = 1; index < beats.length; index += 1) {
    const nextPitch = pitches[index]!;
    if (nextPitch === pitch) continue;
    notes.push(createNote(
      pitch, startTime, beats[index]! - startTime, role, velocityAt(startTime),
    ));
    pitch = nextPitch;
    startTime = beats[index]!;
    mutationCount += 1;
  }
  notes.push(createNote(
    pitch, startTime, CLIP_LENGTH_BEATS - startTime, role, velocityAt(startTime),
  ));
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
  velocity: number = VELOCITY[role],
  probability?: number,
): GeneratedNote {
  return {
    pitch,
    startTime,
    duration,
    velocity,
    ...(probability === undefined ? {} : { probability }),
  };
}

/**
 * ADR 0009: the score is deterministic, the performance is not. Ornaments and
 * connective material carry a probability so Live realises them differently on
 * each pass, while structural notes stay guaranteed and the composition's
 * identity never becomes conditional. Values vary a little per note so the
 * texture thins organically rather than in lockstep.
 */
export function ornamentProbability(
  laneSeed: number,
  label: string,
  drift: number,
): number {
  // At rest the performance is nearly faithful; Drift widens how far a pass may
  // thin its ornament before the composition's identity is at stake.
  const softest = interpolate(0.88, 0.45, drift);
  const firmest = interpolate(0.97, 0.8, drift);
  const chance = interpolate(softest, firmest, macroUnit(laneSeed, `probability:${label}`));
  return Math.round(chance * 100) / 100;
}

/**
 * Roles whose register may roam. Bass and Drone hold the floor of the mix, so
 * displacing them undoes the orchestration rather than colouring it.
 */
const DISPLACEABLE: Readonly<Record<MusicalRole, readonly number[]>> = {
  bass: [],
  drone: [],
  pad: [-12, 12],
  "arp-source": [-12, 12],
  lead: [12, -12, 12],
};

const MAX_DISPLACEMENT_RATE = 0.28;
const DISPLACEMENT_FLOOR = 24;
const DISPLACEMENT_CEILING = 100;

/**
 * Throws the occasional note into another octave. Every note stays in the
 * project scale — only its register moves — so this buys variety without ever
 * producing a wrong note.
 */
export function driftOctave(
  pitch: number,
  role: MusicalRole,
  drift: number,
  laneSeed: number,
  label: string,
): number {
  const offsets = DISPLACEABLE[role];
  if (offsets.length === 0 || drift <= 0) return pitch;

  const roll = macroUnit(laneSeed, `displace:${label}`);
  if (roll >= drift * MAX_DISPLACEMENT_RATE) return pitch;

  const offset = offsets[Math.floor(roll * 997) % offsets.length]!;
  const moved = pitch + offset;
  return moved < DISPLACEMENT_FLOOR || moved > DISPLACEMENT_CEILING ? pitch : moved;
}

/**
 * Ambient lives on slow swells, so each Scene shapes its dynamics across the
 * whole Cycle rather than sitting at one level. Foundation breathes gently,
 * Development builds, Tension arrives early and stays, Release recedes. Without
 * this every clip is dynamically flat from first beat to last.
 */
const DYNAMIC_ARC: Readonly<Record<SceneKind, (position: number) => number>> = {
  foundation: (position) => Math.sin(position * Math.PI) * 4 - 1,
  development: (position) => interpolate(-7, 7, position),
  tension: (position) => interpolate(-4, 8, Math.min(1, position * 2)),
  release: (position) => interpolate(6, -9, position),
};

/** Velocity offset for a beat's place in the Scene Cycle. */
export function dynamicOffset(scene: SceneKind, beat: number): number {
  const position = Math.min(Math.max(beat / CLIP_LENGTH_BEATS, 0), 1);
  return DYNAMIC_ARC[scene](position);
}

export function clampVelocity(value: number): number {
  return Math.min(Math.max(Math.round(value), 30), 118);
}

/**
 * Tension is not only a harmonic quality. It presses the sustained roles louder
 * and, more tellingly, less evenly: a tense texture is unsteady as well as
 * bright, so the spread widens along with the level. The Scene's swell rides on
 * top of that.
 */
export function sustainedVelocity(
  role: MusicalRole,
  recipe: GenerationRecipe,
  scene: SceneKind,
  beat: number,
  laneSeed: number,
  label: string,
): number {
  const lift = interpolate(-6, 10, recipe.parameters.tension);
  const spread = interpolate(2, 9, recipe.parameters.tension);
  const jitter = (macroUnit(laneSeed, `velocity:${label}`) * 2 - 1) * spread;
  return clampVelocity(VELOCITY[role] + lift + jitter + dynamicOffset(scene, beat));
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
