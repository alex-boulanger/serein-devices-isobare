import { averageSpacing, CLIP_LENGTH_BEATS, totalMovement } from "./composition-plan";
import { createRandom, deriveSeed } from "./random";
import {
  ROLE_NAMES,
  SCENE_NAMES,
  type CompositionPlan,
  type GeneratedNote,
  type GeneratedScene,
  type GenerationRecipe,
  type HarmonicPath,
  type MusicalRole,
  type RoleLaneRecipe,
  type SceneKind,
} from "./types";

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

interface RenderedRole {
  readonly notes: readonly GeneratedNote[];
  readonly mutationCount: number;
  readonly densityChangeCount: number;
}

interface DensityEvent {
  readonly beat: number;
  readonly voiceCount: number;
}

interface PitchSetEvent {
  readonly beat: number;
  readonly pitches: readonly number[];
}

export function renderRoleScenes(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  lane: RoleLaneRecipe,
  roleInstance: number,
): GeneratedScene[] {
  const laneSeed = deriveSeed(recipe.seed, `lane:${lane.id}:${lane.role}:${roleInstance}`);
  return plan.paths.map((path) => {
    const rendered = renderRolePath(recipe, plan, path, lane, roleInstance, laneSeed);
    const roleName = `${ROLE_NAMES[lane.role]}${roleInstance > 0 ? ` ${roleInstance + 1}` : ""}`;
    return {
      kind: path.scene,
      name: `${SCENE_NAMES[path.scene]} — ${roleName}`,
      durationBeats: CLIP_LENGTH_BEATS,
      notes: rendered.notes.map((note) => ({
        ...note,
        pitch: note.pitch + lane.octaveOffset * 12,
      })),
      metrics: {
        noteCount: rendered.notes.length,
        mutationCount: rendered.mutationCount,
        densityChangeCount: rendered.densityChangeCount,
        averageMovement: averagePathMovement(path),
        averageSpacing: averagePathSpacing(path),
      },
    };
  });
}

function renderRolePath(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  path: HarmonicPath,
  lane: RoleLaneRecipe,
  roleInstance: number,
  laneSeed: number,
): RenderedRole {
  switch (lane.role) {
    case "bass": return renderBass(recipe, plan, path, roleInstance);
    case "pad": return renderPad(recipe, plan, path, roleInstance, laneSeed);
    case "drone": return renderDrone(recipe, plan, path, roleInstance);
    case "arp-source": return renderArpSource(recipe, plan, path, roleInstance, laneSeed);
  }
}

function renderPad(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  path: HarmonicPath,
  roleInstance: number,
  laneSeed: number,
): RenderedRole {
  const density = createDensityContour(recipe, path.scene, "pad", laneSeed);
  const priority = complementVoicePriority(
    prioritizeVoices(path.events[0]!.pitches, plan),
    roleInstance,
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

function renderBass(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  path: HarmonicPath,
  roleInstance: number,
): RenderedRole {
  const selected = selectPathEvents(path, mutationBudget(recipe, path.scene, "bass"));
  const pitches = selected.map((event, index) =>
    bassPitchForEvent(event.pitches, plan, index + roleInstance),
  );
  return renderMonophonicSegments(selected.map((event) => event.beat), pitches, "bass");
}

function renderDrone(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  path: HarmonicPath,
  roleInstance: number,
): RenderedRole {
  const selected = selectPathEvents(path, mutationBudget(recipe, path.scene, "drone"));
  const pitches = selected.map((_event, index) => {
    const pitchClass = plan.transitionAnchors[
      (index + roleInstance) % plan.transitionAnchors.length
    ]
      ?? plan.pitchHierarchy.root;
    return pitchForClassNear(pitchClass, index === 0 ? 38 : 43, 28, 60);
  });
  return renderMonophonicSegments(selected.map((event) => event.beat), pitches, "drone");
}

function renderArpSource(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  path: HarmonicPath,
  roleInstance: number,
  laneSeed: number,
): RenderedRole {
  const density = createDensityContour(recipe, path.scene, "arp-source", laneSeed);
  const selectedPath = {
    ...path,
    events: selectPathEvents(path, mutationBudget(recipe, path.scene, "arp-source")),
  };
  const selectPitches = (pitches: readonly number[], voiceCount: number) =>
    createArpPitchSet(recipe, plan, pitches, voiceCount, roleInstance);
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

function mutationBudget(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: MusicalRole,
): number {
  const [minimum, maximum] = MUTATION_RANGES[role][scene];
  if (recipe.parameters.motion < 1 / 3) return minimum;
  if (recipe.parameters.motion > 2 / 3) return maximum;
  return Math.round((minimum + maximum) / 2);
}

function selectPathEvents(path: HarmonicPath, mutationCount: number) {
  const mutations = path.events.slice(1);
  if (mutationCount <= 0 || mutations.length === 0) return [path.events[0]!];
  const count = Math.min(mutationCount, mutations.length);
  const selected = Array.from({ length: count }, (_, index) => {
    const mutationIndex = Math.floor(((index + 1) * mutations.length) / (count + 1));
    return mutations[Math.min(mutationIndex, mutations.length - 1)]!;
  });
  return [path.events[0]!, ...uniqueEvents(selected)];
}

function renderMonophonicSegments(
  beats: readonly number[],
  pitches: readonly number[],
  role: "bass" | "drone",
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

function createDensityContour(
  recipe: GenerationRecipe,
  scene: SceneKind,
  role: "pad" | "arp-source",
  laneSeed: number,
): DensityEvent[] {
  const random = createRandom(deriveSeed(laneSeed, `density:${role}:${scene}`));
  const earlyBeat = random.pick([6, 8, 10, 12, 14]);
  const lateBeat = random.pick([22, 24, 26, 28, 30]);

  switch (scene) {
    case "foundation":
      return [
        { beat: 0, voiceCount: 2 },
        { beat: earlyBeat, voiceCount: 3 },
        { beat: lateBeat, voiceCount: 2 },
      ];
    case "development":
      return [
        { beat: 0, voiceCount: 3 },
        { beat: earlyBeat, voiceCount: 2 },
        { beat: lateBeat, voiceCount: 3 },
      ];
    case "tension": {
      const fifthVoiceProbability = 0.15 + recipe.parameters.tension * 0.55;
      if (role === "arp-source" && random.next() < fifthVoiceProbability) {
        return [
          { beat: 0, voiceCount: 4 },
          { beat: earlyBeat, voiceCount: 5 },
          { beat: lateBeat, voiceCount: 4 },
        ];
      }
      return [{ beat: 0, voiceCount: 4 }];
    }
    case "release":
      return [
        { beat: 0, voiceCount: 3 },
        { beat: earlyBeat, voiceCount: 2 },
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

function latestAt<T extends { readonly beat: number }>(events: readonly T[], beat: number): T {
  return events.reduce((latest, event) => event.beat <= beat ? event : latest, events[0]!);
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

function bassPitchForEvent(
  harmony: readonly number[],
  plan: CompositionPlan,
  eventIndex: number,
): number {
  const candidates = unique([
    ...plan.pitchHierarchy.anchors,
    ...harmony.map((pitch) => pitch % 12),
  ]);
  const pitchClass = candidates[eventIndex % candidates.length]
    ?? plan.pitchHierarchy.root;
  return pitchForClassNear(pitchClass, eventIndex % 2 === 0 ? 36 : 41, 24, 48);
}

function pitchForClassNear(
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

function createNote(
  pitch: number,
  startTime: number,
  duration: number,
  role: MusicalRole,
): GeneratedNote {
  return { pitch, startTime, duration, velocity: VELOCITY[role] };
}

function averagePathMovement(path: HarmonicPath): number {
  if (path.events.length < 2) return 0;
  const total = path.events.slice(1).reduce(
    (sum, event, index) => sum + totalMovement(path.events[index]!.pitches, event.pitches),
    0,
  );
  return total / (path.events.length - 1);
}

function averagePathSpacing(path: HarmonicPath): number {
  if (path.events.length === 0) return 0;
  return path.events.reduce((sum, event) => sum + averageSpacing(event.pitches), 0)
    / path.events.length;
}

function sortNotes(notes: readonly GeneratedNote[]): GeneratedNote[] {
  return [...notes].sort(
    (left, right) => left.startTime - right.startTime || left.pitch - right.pitch,
  );
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function uniqueEvents<T extends { readonly beat: number }>(values: readonly T[]): T[] {
  const seen = new Set<number>();
  return values.filter((value) => {
    if (seen.has(value.beat)) return false;
    seen.add(value.beat);
    return true;
  });
}
