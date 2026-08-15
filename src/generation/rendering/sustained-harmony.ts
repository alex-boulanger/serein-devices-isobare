import { createRandom, deriveSeed } from "../random";
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
  selectPathEvents,
} from "./note-mechanics";
import type { RenderedRole, RoleRenderContext } from "./types";

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
    notes: renderSustainedPitchSets(states, "pad"),
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
    notes: renderSustainedPitchSets(pitchSetEvents, "arp-source"),
    mutationCount: countAudibleHarmonicChanges(
      selectedPath,
      density,
      selectPitches,
    ),
    densityChangeCount: density.length - 1,
  };
}

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
  const scaleCount = (count: number) => Math.max(2, Math.ceil(count * densityScale));

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

function renderSustainedPitchSets(
  events: readonly PitchSetEvent[],
  role: "pad" | "arp-source",
): GeneratedNote[] {
  const notes: GeneratedNote[] = [];
  const allPitches = unique(events.flatMap((event) => event.pitches));

  for (const pitch of allPitches) {
    let startTime: number | undefined;
    for (const event of events) {
      const active = event.pitches.includes(pitch);
      if (active && startTime === undefined) {
        startTime = event.beat;
      } else if (!active && startTime !== undefined) {
        notes.push(createNote(pitch, startTime, event.beat - startTime, role));
        startTime = undefined;
      }
    }
    if (startTime !== undefined) {
      notes.push(createNote(pitch, startTime, CLIP_LENGTH_BEATS - startTime, role));
    }
  }
  return sortNotes(notes);
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
  const pitches = pitchClasses.slice(0, voiceCount).map((pitchClass) => {
    const scaleIndex = recipe.parameters.scale.intervals.findIndex(
      (interval) => (recipe.parameters.rootPitchClass + interval) % 12 === pitchClass,
    );
    const target = 50 + Math.max(0, scaleIndex) * (2.5 + recipe.parameters.space * 1.5);
    return pitchForClassNear(pitchClass, target, 48, 84);
  });

  let duplicateIndex = 0;
  while (pitches.length < voiceCount && pitches.length > 0) {
    const source = pitches[duplicateIndex % pitches.length]!;
    const octave = source + 12 <= 84 ? source + 12 : source - 12;
    if (!pitches.includes(octave)) pitches.push(octave);
    duplicateIndex += 1;
  }
  return unique(pitches).slice(0, voiceCount);
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
