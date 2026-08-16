import { driftOf, interpolate, macroUnit, resolveCount, spaceGate } from "../macros";
import { createRandom, deriveSeed, type RandomSource } from "../random";
import { CLIP_LENGTH_BEATS } from "../planning/composition-plan";
import type {
  CompositionPlan,
  GeneratedNote,
  GenerationRecipe,
  HarmonicPath,
  MusicalRole,
  SceneKind,
} from "../types";
import {
  createNote,
  latestAt,
  mutationBudget,
  pitchForClassNear,
  ornamentProbability,
  selectPathEvents,
  sustainedVelocity,
} from "./note-mechanics";
import type { RenderedRole, RoleRenderContext } from "./types";

/** A gated voice still has to be an audible note, not a click. */
const MINIMUM_SUSTAIN = 0.75;

/** How far, in beats, upper voices may bloom in behind the anchor at full Space. */
const MAX_ENTRANCE_SPREAD = 6;

/** A long hold may break into at most this many re-articulations. */
const MAX_HOLD_SEGMENTS = 3;

/** Holds shorter than this stay whole rather than being chopped into clicks. */
const MIN_SEGMENT_LENGTH = 3;

/** Splitting always leaves audible air between the pieces. */
const SEGMENT_GATE_CEILING = 0.9;

/** Register the Arp Source is voiced into, and how far apart its voices sit. */
const ARP_LOWEST = 44;
const ARP_HIGHEST = 88;
const ARP_GAP_TIGHT = 3;
const ARP_GAP_OPEN = 7;

interface DensityEvent {
  readonly beat: number;
  readonly voiceCount: number;
}

interface PitchSetEvent {
  readonly beat: number;
  readonly pitches: readonly number[];
}

export function renderPad(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration, laneSeed, profile } = context;
  const density = createDensityContour(
    recipe,
    path.scene,
    "pad",
    laneSeed,
    profile.densityScale,
  );
  const priority = complementVoicePriority(
    prioritizeVoices(path.events[0]!.pitches, plan),
    orchestration.roleInstance,
  );
  const selectPitches = (pitches: readonly number[], voiceCount: number) =>
    priority.slice(0, voiceCount).map((voice) => pitches[voice]!);
  const states = mergeHarmonyAndDensity(path, density, selectPitches);
  return {
    notes: renderSustainedPitchSets(
      states,
      "pad",
      recipe,
      path.scene,
      orchestration.downbeatOffset,
      laneSeed,
    ),
    mutationCount: countAudibleHarmonicChanges(path, density, selectPitches),
    densityChangeCount: density.length - 1,
  };
}

export function renderArpSource(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration, laneSeed, profile } = context;
  const density = createDensityContour(
    recipe,
    path.scene,
    "arp-source",
    laneSeed,
    profile.densityScale,
  );
  const selectedPath = {
    ...path,
    events: selectPathEvents(
      path,
      mutationBudget(recipe, path.scene, "arp-source"),
    ),
  };
  const selectPitches = (pitches: readonly number[], voiceCount: number) =>
    createArpPitchSet(
      recipe,
      plan,
      pitches,
      voiceCount,
      orchestration.roleInstance,
    );
  const pitchSetEvents = mergeHarmonyAndDensity(
    selectedPath,
    density,
    selectPitches,
  );
  return {
    notes: renderSustainedPitchSets(
      pitchSetEvents,
      "arp-source",
      recipe,
      path.scene,
      orchestration.downbeatOffset,
      laneSeed,
    ),
    mutationCount: countAudibleHarmonicChanges(
      selectedPath,
      density,
      selectPitches,
    ),
    densityChangeCount: density.length - 1,
  };
}

/**
 * Occupancy is where Motion and Tension become audible in the sustained roles:
 * Tension buys an extra voice, Motion decides how many times the voice count is
 * allowed to change within the Scene Cycle. Without this the contour is a fixed
 * shape and these two roles — roughly half of all notes — ignore the macros.
 */
function createDensityContour(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: "pad" | "arp-source",
  laneSeed: number,
  densityScale: number,
): DensityEvent[] {
  const random = createRandom(deriveSeed(laneSeed, `density:${role}:${scene}`));
  const earlyBeat = random.pick([6, 8, 10, 12, 14]);
  const lateBeat = random.pick([22, 24, 26, 28, 30]);
  const voiceBonus = resolveCount(
    0,
    1,
    recipe.parameters.tension,
    laneSeed,
    `density-voices:${role}:${scene}`,
  );
  const scaleCount = (count: number) =>
    Math.max(2, Math.ceil((count + voiceBonus) * densityScale));

  return limitDensityChanges(
    createSceneShape(recipe, scene, role, random, earlyBeat, lateBeat, scaleCount),
    recipe.parameters.motion,
    laneSeed,
    `density-changes:${role}:${scene}`,
  );
}

function limitDensityChanges(
  events: readonly DensityEvent[],
  motion: number,
  laneSeed: number,
  label: string,
): DensityEvent[] {
  if (events.length <= 1) return [...events];
  const keep = resolveCount(1, events.length, motion, laneSeed, label);
  return events.slice(0, Math.max(1, keep));
}

function createSceneShape(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: "pad" | "arp-source",
  random: RandomSource,
  earlyBeat: number,
  lateBeat: number,
  scaleCount: (count: number) => number,
): DensityEvent[] {
  switch (scene) {
    case "foundation":
      return [
        { beat: 0, voiceCount: scaleCount(2) },
        { beat: earlyBeat, voiceCount: scaleCount(3) },
        { beat: lateBeat, voiceCount: scaleCount(2) },
      ];
    case "development":
      return [
        { beat: 0, voiceCount: scaleCount(3) },
        { beat: earlyBeat, voiceCount: scaleCount(2) },
        { beat: lateBeat, voiceCount: scaleCount(3) },
      ];
    case "tension": {
      const fifthVoiceProbability = 0.15 + recipe.parameters.tension * 0.55;
      if (role === "arp-source" && random.next() < fifthVoiceProbability) {
        return [
          { beat: 0, voiceCount: scaleCount(4) },
          { beat: earlyBeat, voiceCount: scaleCount(5) },
          { beat: lateBeat, voiceCount: scaleCount(4) },
        ];
      }
      return [{ beat: 0, voiceCount: scaleCount(4) }];
    }
    case "release":
      return [
        { beat: 0, voiceCount: scaleCount(3) },
        { beat: earlyBeat, voiceCount: scaleCount(2) },
      ];
  }
}

function mergeHarmonyAndDensity(
  path: HarmonicPath,
  density: readonly DensityEvent[],
  selectPitches: (pitches: readonly number[], voiceCount: number) => readonly number[],
): PitchSetEvent[] {
  const beats = unique([
    ...path.events.map((event) => event.beat),
    ...density.map((event) => event.beat),
  ]).sort((left, right) => left - right);
  const states = beats.map((beat) => {
    const harmony = latestAt(path.events, beat);
    const occupancy = latestAt(density, beat);
    return {
      beat,
      pitches: [...selectPitches(harmony.pitches, occupancy.voiceCount)]
        .sort((left, right) => left - right),
    };
  });
  return states.filter(
    (event, index) => index === 0 || !samePitches(event.pitches, states[index - 1]!.pitches),
  );
}

/**
 * Space redistributes attacks as well as trimming tails. Trimming alone left
 * every voice landing on the downbeat and the whole bar emptying behind it, so
 * Space also blooms the voices in across a window and lets a long hold
 * re-articulate mid-cycle. The lowest voice of the opening chord stays on beat
 * zero, so the Scene still establishes material the moment it is launched.
 */
function renderSustainedPitchSets(
  events: readonly PitchSetEvent[],
  role: "pad" | "arp-source",
  recipe: GenerationRecipe,
  scene: SceneKind,
  downbeatOffset: number,
  laneSeed: number,
): GeneratedNote[] {
  const notes: GeneratedNote[] = [];
  const allPitches = unique(events.flatMap((event) => event.pitches));
  const { space } = recipe.parameters;
  const anchorPitch = Math.min(...(events[0]?.pitches ?? allPitches));
  // An Arp Source is material for Live's Arpeggiator, not something heard
  // directly: releasing it early or chopping it stops the arpeggio rather than
  // opening the texture. Space still shapes its register, never its envelope.
  const holdsWholeSpan = role === "arp-source";
  const spread = holdsWholeSpan ? 0 : interpolate(0, MAX_ENTRANCE_SPREAD, space);

  const emit = (pitch: number, start: number, duration: number, probability?: number) =>
    notes.push(createNote(
      pitch,
      start,
      duration,
      role,
      sustainedVelocity(role, recipe, scene, start, laneSeed, `${role}:${pitch}:${start}`),
      probability,
    ));

  const push = (pitch: number, from: number, until: number) => {
    if (holdsWholeSpan) {
      // Exempt from downbeat allocation as well as from gating. That allocation
      // exists to stop several roles striking audibly at once, and an Arp
      // Source's onsets are not heard directly — Live's Arpeggiator
      // re-articulates them at its own rate — so delaying its entrance buys
      // nothing and merely opens a hole at the top of the clip.
      if (until - from >= MINIMUM_SUSTAIN) emit(pitch, from, until - from);
      return;
    }

    const start = pitch === anchorPitch
      // The anchor holds the downbeat only when this lane owns it; otherwise the
      // whole chord enters behind whichever lane does.
      ? (from === 0 ? Math.min(downbeatOffset, until - MINIMUM_SUSTAIN) : from)
      : entranceOf(pitch, from, until, spread, laneSeed, role);
    if (until - start < MINIMUM_SUSTAIN) return;

    const voiceGate = spaceGate(space)
      * (0.9 + 0.2 * macroUnit(laneSeed, `gate:${role}:${pitch}`));
    const segments = holdSegments(
      start,
      until,
      voiceGate,
      space,
      recipe.parameters.motion,
      laneSeed,
      `${role}:${pitch}`,
    );
    segments.forEach((segment, index) => {
      // The voice's first statement holds the harmony; the re-articulations
      // after it are ornament, so Live may thin them from pass to pass.
      emit(
        pitch,
        segment.start,
        segment.duration,
        index === 0
          ? undefined
          : ornamentProbability(laneSeed, `${role}:${pitch}:${segment.start}`, driftOf(recipe.parameters)),
      );
    });
  };

  for (const pitch of allPitches) {
    let startTime: number | undefined;
    for (const event of events) {
      const active = event.pitches.includes(pitch);
      if (active && startTime === undefined) {
        startTime = event.beat;
      } else if (!active && startTime !== undefined) {
        push(pitch, startTime, event.beat);
        startTime = undefined;
      }
    }
    if (startTime !== undefined) {
      push(pitch, startTime, CLIP_LENGTH_BEATS);
    }
  }
  return sortNotes(notes);
}

/** Where an upper voice actually enters, never so late that it cannot sound. */
function entranceOf(
  pitch: number,
  from: number,
  until: number,
  spread: number,
  laneSeed: number,
  role: string,
): number {
  const offset = spread * macroUnit(laneSeed, `entrance:${role}:${pitch}:${from}`);
  const latest = until - MINIMUM_SUSTAIN;
  return Math.max(from, Math.min(from + offset, latest));
}

/**
 * A held voice either sustains once or re-articulates a few times across the
 * hold. More Space buys more pieces, which is what puts attacks in the later
 * bars instead of leaving all of them stacked on the downbeat.
 */
function holdSegments(
  start: number,
  until: number,
  voiceGate: number,
  space: number,
  motion: number,
  laneSeed: number,
  label: string,
): readonly { readonly start: number; readonly duration: number }[] {
  const length = until - start;
  const maximum = Math.min(
    MAX_HOLD_SEGMENTS,
    Math.max(1, Math.floor(length / MIN_SEGMENT_LENGTH)),
  );
  // Space decides whether a hold may break at all — at zero the roles still
  // fuse into one wall — while Motion scales how many pieces it breaks into.
  const drive = space * interpolate(0.6, 1.4, motion);
  const segments = resolveCount(1, maximum, drive, laneSeed, `rearticulate:${label}:${start}`);

  if (segments <= 1) {
    return [{
      start,
      duration: Math.max(MINIMUM_SUSTAIN, Math.min(length, length * voiceGate)),
    }];
  }

  // Each slot is at least MIN_SEGMENT_LENGTH, so the gated piece always clears
  // MINIMUM_SUSTAIN and always leaves a gap before the next one.
  const slot = length / segments;
  const ratio = Math.min(voiceGate, SEGMENT_GATE_CEILING);
  return Array.from({ length: segments }, (_, index) => ({
    start: start + index * slot,
    duration: slot * ratio,
  }));
}

function prioritizeVoices(
  pitches: readonly number[],
  plan: CompositionPlan,
): number[] {
  const rootVoice = pitches.findIndex((pitch) => pitch % 12 === plan.pitchHierarchy.root);
  const anchorVoices = pitches
    .map((_pitch, index) => index)
    .filter((index) =>
      index !== rootVoice && plan.pitchHierarchy.anchors.includes(pitches[index]! % 12),
    )
    .sort((left, right) =>
      Math.abs(pitches[right]! - (pitches[rootVoice] ?? pitches[0]!)) -
      Math.abs(pitches[left]! - (pitches[rootVoice] ?? pitches[0]!)),
    );
  const colorVoices = pitches
    .map((_pitch, index) => index)
    .filter((index) => plan.pitchHierarchy.colors.includes(pitches[index]! % 12));
  const remaining = pitches
    .map((_pitch, index) => index)
    .filter((index) =>
      index !== rootVoice && !anchorVoices.includes(index) && !colorVoices.includes(index),
    );
  return unique([
    ...(rootVoice >= 0 ? [rootVoice] : []),
    ...anchorVoices.slice(0, 1),
    ...colorVoices,
    ...anchorVoices.slice(1),
    ...remaining,
  ]);
}

/**
 * Stacks the chosen pitch classes upward, each voice at least a minimum gap
 * above the one below, taking whichever octave of that class clears the gap.
 *
 * Choosing an octave per class independently packs neighbouring scale degrees
 * into the same octave a step apart, which reaches Live's Arpeggiator as a
 * cluster rather than a chord. Stacking with a floor turns those steps into
 * octave jumps instead, and Space widens the floor so the arpeggio opens out.
 */
function spreadArpVoicing(
  pitchClasses: readonly number[],
  recipe: GenerationRecipe,
): number[] {
  const minimumGap = interpolate(ARP_GAP_TIGHT, ARP_GAP_OPEN, recipe.parameters.space);
  // Tension presses the whole stack upward as well as outward.
  let floor = interpolate(ARP_LOWEST, ARP_LOWEST + 8, recipe.parameters.tension);
  const pitches: number[] = [];

  for (const pitchClass of pitchClasses) {
    const pitch = lowestPitchOfClassAtOrAbove(pitchClass, floor);
    if (pitch > ARP_HIGHEST) break;
    pitches.push(pitch);
    floor = pitch + minimumGap;
  }
  return pitches;
}

/** The lowest pitch of this class that is not below `floor`. */
function lowestPitchOfClassAtOrAbove(pitchClass: number, floor: number): number {
  const octaves = Math.ceil((floor - pitchClass) / 12);
  return pitchClass + octaves * 12;
}

function complementVoicePriority(priority: readonly number[], roleInstance: number): number[] {
  if (roleInstance === 0 || priority.length <= 2) return [...priority];
  const stable = priority.slice(0, 2);
  const optional = priority.slice(2);
  const offset = roleInstance % optional.length;
  return [...stable, ...optional.slice(offset), ...optional.slice(0, offset)];
}

function createArpPitchSet(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  harmony: readonly number[],
  voiceCount: number,
  roleInstance: number,
): number[] {
  const basePitchClasses = unique([
    plan.pitchHierarchy.root,
    ...harmony.map((pitch) => pitch % 12),
    ...plan.transitionAnchors,
    ...plan.pitchHierarchy.colors,
  ]);
  const stable = basePitchClasses.slice(0, 2);
  const optional = basePitchClasses.slice(2);
  const offset = optional.length === 0 ? 0 : roleInstance % optional.length;
  const pitchClasses = [
    ...stable,
    ...optional.slice(offset),
    ...optional.slice(0, offset),
  ];
  // If the spread runs out of register before every voice is placed, take the
  // thinner chord. Padding it with octave copies is what used to reintroduce
  // the clusters this voicing exists to avoid.
  return spreadArpVoicing(pitchClasses.slice(0, voiceCount), recipe);
}

function countAudibleHarmonicChanges(
  path: HarmonicPath,
  density: readonly DensityEvent[],
  selectPitches: (pitches: readonly number[], voiceCount: number) => readonly number[],
): number {
  let changes = 0;
  for (let index = 1; index < path.events.length; index += 1) {
    const previous = path.events[index - 1]!;
    const current = path.events[index]!;
    const voiceCount = latestAt(density, current.beat).voiceCount;
    const previousPitches = [...selectPitches(previous.pitches, voiceCount)]
      .sort((left, right) => left - right);
    const currentPitches = [...selectPitches(current.pitches, voiceCount)]
      .sort((left, right) => left - right);
    if (!samePitches(previousPitches, currentPitches)) changes += 1;
  }
  return changes;
}

function samePitches(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((pitch, index) => pitch === right[index]);
}

function sortNotes(notes: readonly GeneratedNote[]): GeneratedNote[] {
  return [...notes].sort(
    (left, right) => left.startTime - right.startTime || left.pitch - right.pitch,
  );
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}
