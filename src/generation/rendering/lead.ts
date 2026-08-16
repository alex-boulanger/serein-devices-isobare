import { driftOf, interpolate, macroUnit, resolveCount } from "../macros";
import { createRandom, deriveSeed } from "../random";
import type {
  GeneratedNote,
  GenerationRecipe,
  HarmonicPath,
  MelodicMotif,
  LeadStyle,
  SceneKind,
} from "../types";
import { dynamicOffset, latestAt, ornamentProbability } from "./note-mechanics";
import type { RenderedRole, RoleRenderContext } from "./types";

interface MelodicEvent {
  readonly beat: number;
  readonly degree: number;
}

/** At or above this Tension the interior of a phrase keeps its friction. */
const CLASH_TOLERANCE_TENSION = 0.7;

/** How far a note may be pulled, in scale degrees, to agree with the harmony. */
const ALIGNMENT_OFFSETS = [0, -1, 1, -2, 2] as const;

const SCENE_MUTATIONS: Readonly<Record<SceneKind, number>> = {
  foundation: 0,
  development: 2,
  tension: 3,
  release: 1,
};

const SCENE_VELOCITY: Readonly<Record<SceneKind, number>> = {
  foundation: 72,
  development: 77,
  tension: 84,
  release: 68,
};

export function renderLead(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration, laneSeed, profile } = context;
  const style = orchestration.lane.style;
  if (style !== "pluck" && style !== "flow") {
    throw new Error("A Lead lane requires a Pluck or Flow style.");
  }

  const phrase = createScenePhrase(
    recipe,
    plan.melodicMotif,
    path.scene,
    laneSeed,
    orchestration.roleInstance,
    orchestration.downbeatOffset,
  );
  // Thinned by the role's own Scene activity, never by the Role Family density
  // budget. That budget exists to stop harmonic crowding; applying it to a
  // foreground line just makes the lead disappear behind the texture it is
  // supposed to sit on top of.
  const events = alignPhraseToHarmony(
    recipe,
    path,
    thinPhrase(phrase, profile.activity),
  );
  const random = createRandom(deriveSeed(laneSeed, `lead:velocity:${path.scene}`));
  const notes = events.map((event, index) => {
    const nextBeat = events[index + 1]?.beat ?? 32;
    const gap = nextBeat - event.beat;
    // The phrase's first and last notes carry its identity; what lies between
    // them is passing material and may vary from pass to pass.
    const isBoundary = index === 0 || index === events.length - 1;
    return {
      pitch: pitchForScaleDegree(recipe, event.degree),
      startTime: event.beat,
      duration: noteDuration(style, gap, recipe.parameters.space),
      velocity: Math.round(clamp(
        SCENE_VELOCITY[path.scene] + (index === 0 ? 5 : 0)
          + dynamicOffset(path.scene, event.beat) + random.integer(-3, 3),
        52,
        104,
      )),
      ...(isBoundary
        ? {}
        : { probability: ornamentProbability(laneSeed, `lead:${path.scene}:${event.beat}`, driftOf(recipe.parameters)) }),
    } satisfies GeneratedNote;
  });

  return {
    notes,
    mutationCount: SCENE_MUTATIONS[path.scene],
    densityChangeCount: 0,
  };
}

function createScenePhrase(
  recipe: GenerationRecipe,
  motif: MelodicMotif,
  scene: SceneKind,
  laneSeed: number,
  roleInstance: number,
  downbeatOffset: number,
): MelodicEvent[] {
  const random = createRandom(deriveSeed(laneSeed, `lead:phrase:${scene}`));
  // Lead is the least structural role, so it almost never owns the downbeat.
  const entrance = Math.max(
    random.integer(0, scene === "tension" ? 2 : 4),
    downbeatOffset,
  );
  const motion = recipe.parameters.motion;
  const scaleLength = recipe.parameters.scale.intervals.length;
  const identityRotation = roleInstance === 0 ? 0 : roleInstance % motif.scaleDegrees.length;
  const degrees = developMotif(
    rotateInterior(motif.scaleDegrees, identityRotation),
    scene,
    driftOf(recipe.parameters),
    laneSeed,
  );

  switch (scene) {
    case "foundation": {
      const count = resolveCount(3, 6, motion, laneSeed, `lead:foundation:${scene}`);
      return degrees.slice(0, count).map((degree, index) => ({
        beat: roundBeat(entrance + motif.rhythm[index]! * (1.12 - motion * 0.25)),
        degree,
      }));
    }
    case "development": {
      const statement = degrees.map((degree, index) => ({
        beat: roundBeat(entrance + motif.rhythm[index]! * 0.88),
        degree: index === 2 && recipe.parameters.tension >= 0.5 ? degree + 1 : degree,
      }));
      const fragmentCount = resolveCount(1, 5, motion, laneSeed, "lead:development");
      const fragment = degrees.slice(1, 1 + fragmentCount).map((degree, index) => ({
        beat: roundBeat(18 + (motif.rhythm[index + 1]! - motif.rhythm[1]!) * 0.72),
        degree: degree + (index === fragmentCount - 1 ? -1 : 0),
      }));
      return sortUniqueEvents([...statement, ...fragment]);
    }
    case "tension": {
      const registerLift = Math.round(recipe.parameters.tension * scaleLength);
      const lifted = degrees.map((degree) => degree + registerLift);
      const statement = lifted.map((degree, index) => ({
        beat: roundBeat(entrance + motif.rhythm[index]! * 0.62),
        degree: (
          (index === 1 && recipe.parameters.tension >= 0.25) ||
          (index === 4 && recipe.parameters.tension >= 0.65)
        ) ? degree + 1 : degree,
      }));
      const fragmentCount = resolveCount(2, 6, motion, laneSeed, "lead:tension");
      const reversed = [...lifted].reverse().slice(0, fragmentCount);
      const fragment = reversed.map((degree, index) => ({
        beat: roundBeat(14 + index * (2.4 - motion * 0.8)),
        degree: index % 2 === 0 ? degree : degree - 1,
      }));
      return sortUniqueEvents([...statement, ...fragment]);
    }
    case "release": {
      const releaseDegrees = selectReleaseDegrees(degrees, scaleLength);
      return [
        { beat: entrance, degree: releaseDegrees[0]! },
        { beat: roundBeat(11 + recipe.parameters.space * 3), degree: releaseDegrees[1]! },
        { beat: roundBeat(23 + recipe.parameters.space * 2), degree: releaseDegrees[2]! },
      ];
    }
  }
}

/**
 * The Melodic Motif supplies contour; the Harmonic Path decides where that
 * contour may land. Phrase boundaries are pulled onto a tone of the harmony
 * sounding beneath them, and interior notes move only when they would sound a
 * semitone against it. Above CLASH_TOLERANCE_TENSION the interior is left
 * alone, so Tension still buys abrasion rather than being smoothed away.
 */
function alignPhraseToHarmony(
  recipe: GenerationRecipe,
  path: HarmonicPath,
  events: readonly MelodicEvent[],
): MelodicEvent[] {
  const smoothInterior = recipe.parameters.tension < CLASH_TOLERANCE_TENSION;
  const result: MelodicEvent[] = [];

  events.forEach((event, index) => {
    const sounding = soundingPitchClasses(path, event.beat);
    const isBoundary = index === 0 || index === events.length - 1;
    const chosen = isBoundary
      ? harmonyDegree(recipe, event.degree, sounding)
      : smoothInterior
        ? resolveClash(recipe, event.degree, sounding)
        : event.degree;

    // Transformation, fragment overlap and alignment can each land a note on the
    // degree before it, and a lead that restates the same note reads as thin.
    // Resolved here rather than afterwards so the nudge still answers to the
    // harmony instead of stepping straight onto a clash.
    const previous = result[result.length - 1]?.degree;
    result.push({
      beat: event.beat,
      degree: chosen === previous
        ? stepAway(recipe, chosen, sounding, result, smoothInterior)
        : chosen,
    });
  });
  return result;
}

/** Moves one degree on, continuing the line's direction and avoiding a clash. */
function stepAway(
  recipe: GenerationRecipe,
  degree: number,
  sounding: ReadonlySet<number>,
  soFar: readonly MelodicEvent[],
  avoidClash: boolean,
): number {
  const previous = soFar[soFar.length - 1]?.degree;
  const before = soFar[soFar.length - 2]?.degree;
  const direction = previous === undefined || before === undefined || before === previous
    ? 1
    : Math.sign(previous - before) || 1;

  const candidates = [
    degree + direction,
    degree - direction,
    degree + direction * 2,
    degree - direction * 2,
  ];
  for (const candidate of candidates) {
    if (!avoidClash || !clashesWithHarmony(recipe, candidate, sounding)) return candidate;
  }
  return degree + direction;
}

function soundingPitchClasses(path: HarmonicPath, beat: number): ReadonlySet<number> {
  return new Set(
    latestAt(path.events, beat).pitches.map((pitch) => ((pitch % 12) + 12) % 12),
  );
}

/** Prefers a harmony tone that is also clash-free, then any harmony tone. */
function harmonyDegree(
  recipe: GenerationRecipe,
  degree: number,
  sounding: ReadonlySet<number>,
): number {
  for (const offset of ALIGNMENT_OFFSETS) {
    const candidate = degree + offset;
    if (
      sounding.has(pitchClassForDegree(recipe, candidate)) &&
      !clashesWithHarmony(recipe, candidate, sounding)
    ) {
      return candidate;
    }
  }
  for (const offset of ALIGNMENT_OFFSETS) {
    const candidate = degree + offset;
    if (sounding.has(pitchClassForDegree(recipe, candidate))) return candidate;
  }
  return degree;
}

function resolveClash(
  recipe: GenerationRecipe,
  degree: number,
  sounding: ReadonlySet<number>,
): number {
  if (!clashesWithHarmony(recipe, degree, sounding)) return degree;
  for (const offset of [-1, 1] as const) {
    if (!clashesWithHarmony(recipe, degree + offset, sounding)) return degree + offset;
  }
  return degree;
}

function clashesWithHarmony(
  recipe: GenerationRecipe,
  degree: number,
  sounding: ReadonlySet<number>,
): boolean {
  const pitchClass = pitchClassForDegree(recipe, degree);
  for (const other of sounding) {
    const interval = Math.abs(pitchClass - other) % 12;
    if (interval === 1 || interval === 11) return true;
  }
  return false;
}

function pitchClassForDegree(recipe: GenerationRecipe, degree: number): number {
  const intervals = recipe.parameters.scale.intervals;
  const normalized = normalizedDegree(degree, intervals.length);
  return (recipe.parameters.rootPitchClass + intervals[normalized]!) % 12;
}

function selectReleaseDegrees(
  degrees: readonly number[],
  scaleLength: number,
): readonly [number, number, number] {
  const first = degrees[0]!;
  const different = degrees.find((degree) =>
    normalizedDegree(degree, scaleLength) !== normalizedDegree(first, scaleLength)
  ) ?? degrees[Math.floor(degrees.length / 2)]!;
  const last = degrees.at(-1)!;
  return [first, different, last];
}

function normalizedDegree(degree: number, scaleLength: number): number {
  return ((degree % scaleLength) + scaleLength) % scaleLength;
}

/**
 * At rest a Scene restates the Melodic Motif; Drift develops it instead, using
 * the classical transformations — inversion mirrors the contour about its first
 * degree, retrograde reverses it, and both together do each. The motif stays
 * recognisable because its intervals are preserved, only their order or
 * direction changes, so this buys structural variety rather than noise.
 */
function developMotif(
  degrees: readonly number[],
  scene: SceneKind,
  drift: number,
  laneSeed: number,
): number[] {
  if (drift <= 0 || scene === "foundation") return [...degrees];

  const roll = macroUnit(laneSeed, `develop:${scene}`);
  if (roll >= drift) return [...degrees];

  const invert = macroUnit(laneSeed, `invert:${scene}`) < 0.5;
  const retrograde = macroUnit(laneSeed, `retrograde:${scene}`) < 0.5;
  const pivot = degrees[0]!;

  const developed = invert
    ? degrees.map((degree) => pivot + (pivot - degree))
    : [...degrees];
  return retrograde ? developed.reverse() : developed;
}

function rotateInterior(degrees: readonly number[], offset: number): number[] {
  if (offset === 0 || degrees.length < 4) return [...degrees];
  const interior = degrees.slice(1, -1);
  const rotation = offset % interior.length;
  return [
    degrees[0]!,
    ...interior.slice(rotation),
    ...interior.slice(0, rotation),
    degrees.at(-1)!,
  ];
}

function thinPhrase(events: readonly MelodicEvent[], densityScale: number): MelodicEvent[] {
  const target = Math.max(3, Math.min(events.length, Math.round(events.length * densityScale)));
  if (target >= events.length) return [...events];
  const selected = Array.from({ length: target }, (_, index) =>
    events[Math.round(index * (events.length - 1) / (target - 1))]!
  );
  return sortUniqueEvents(selected);
}

function pitchForScaleDegree(recipe: GenerationRecipe, degree: number): number {
  const intervals = recipe.parameters.scale.intervals;
  const octave = Math.floor(degree / intervals.length);
  const normalized = normalizedDegree(degree, intervals.length);
  return 60 + recipe.parameters.rootPitchClass + octave * 12 + intervals[normalized]!;
}

/**
 * Space opens the phrase by giving time back as silence, so a note keeps less
 * of the gap before the next one as Space rises. The previous shape did the
 * opposite — it lengthened notes, which closed the phrase up as the macro was
 * opened.
 */
function noteDuration(style: LeadStyle, gap: number, space: number): number {
  const available = Math.max(0.25, gap - 0.2);
  if (style === "pluck") {
    return roundBeat(Math.min(available, interpolate(0.95, 0.35, space)));
  }
  return roundBeat(
    Math.max(0.5, Math.min(available, gap * interpolate(0.92, 0.34, space))),
  );
}

function sortUniqueEvents(events: readonly MelodicEvent[]): MelodicEvent[] {
  const seen = new Set<number>();
  return [...events]
    .sort((left, right) => left.beat - right.beat)
    .filter((event) => {
      if (event.beat >= 32 || seen.has(event.beat)) return false;
      seen.add(event.beat);
      return true;
    });
}

function roundBeat(value: number): number {
  return Math.round(value * 4) / 4;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
