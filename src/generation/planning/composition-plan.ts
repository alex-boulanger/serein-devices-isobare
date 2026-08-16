import { resolveCount } from "../macros";
import { createRandom, deriveSeed, type RandomSource } from "../random";
import {
  SCENE_KINDS,
  type CompositionPlan,
  type GenerationRecipe,
  type HarmonicEvent,
  type HarmonicPath,
  type PitchHierarchy,
  type SceneKind,
} from "../types";
import { createMelodicMotif } from "./melodic-motif";

export const CLIP_LENGTH_BEATS = 32;
const BEAM_WIDTH = 14;

/**
 * How many times the shared harmony may move within one Scene Cycle. The floors
 * are low on purpose: at rest Motion should mean genuine stillness, which is
 * what gives the middle of the slider somewhere to travel.
 */
const PAD_MUTATION_RANGES: Readonly<Record<SceneKind, readonly [number, number]>> = {
  foundation: [0, 2],
  development: [0, 4],
  tension: [1, 6],
  release: [0, 2],
};

const SCENE_TENSION_OFFSET: Readonly<Record<SceneKind, number>> = {
  foundation: -0.18,
  development: 0,
  tension: 0.24,
  release: -0.24,
};

interface PathCandidate {
  readonly states: readonly number[][];
  readonly score: number;
}

export function createCompositionPlan(recipe: GenerationRecipe): CompositionPlan {
  const hierarchy = createPitchHierarchy(recipe);
  const transitionAnchors = hierarchy.anchors.slice(0, 3);
  const allowedPitches = createAllowedPitches(recipe, 34, 78);
  const foundation = createInitialVoicing(recipe, hierarchy, allowedPitches);

  const paths = SCENE_KINDS.map((scene, sceneIndex) => {
    const random = createRandom(deriveSeed(recipe.seed, `scene:${scene}`));
    const start = sceneIndex === 0
      ? foundation
      : createSceneVariation(foundation, scene, allowedPitches, transitionAnchors, random);
    return createPath(
      recipe, hierarchy, transitionAnchors, scene, start, allowedPitches, random,
    );
  });

  return {
    pitchHierarchy: hierarchy,
    transitionAnchors,
    paths,
    melodicMotif: createMelodicMotif(recipe, hierarchy),
  };
}

/** How strongly a Scene's closing voicing is pulled onto Transition Anchors. */
const TRANSITION_ANCHOR_WEIGHT = 1.2;

/** How many Foundation candidates to keep, and how far below the best one may score. */
const VOICING_POOL_SIZE = 128;
const VOICING_QUALITY_WINDOW = 1;
/** How far a sampled voicing may sit from the best available Tension fit. */
const VOICING_TENSION_WINDOW = 0.1;

function transitionAnchorCount(
  pitches: readonly number[],
  transitionAnchors: readonly number[],
): number {
  return pitches.filter(
    (pitch) => transitionAnchors.includes(((pitch % 12) + 12) % 12),
  ).length;
}

/** Keeps only the candidates richest in Transition Anchors, ties intact. */
function richestInAnchors(
  candidates: readonly number[][],
  transitionAnchors: readonly number[],
): number[][] {
  let best = -1;
  let winners: number[][] = [];
  for (const candidate of candidates) {
    const count = transitionAnchorCount(candidate, transitionAnchors);
    if (count > best) {
      best = count;
      winners = [candidate];
    } else if (count === best) {
      winners.push(candidate);
    }
  }
  return winners;
}

function createPitchHierarchy(recipe: GenerationRecipe): PitchHierarchy {
  const { rootPitchClass, scale } = recipe.parameters;
  const pitchClasses = scale.intervals.map(
    (interval) => (rootPitchClass + interval) % 12,
  );
  const root = rootPitchClass;
  const nonRoot = pitchClasses.filter((pitchClass) => pitchClass !== root);
  const random = createRandom(deriveSeed(recipe.seed, "pitch-hierarchy"));
  // Bass and Drone play anchors and nothing else, so a fixed fifth pinned their
  // entire pitch content to one world per scale. A fourth or a sixth grounds the
  // harmony just as firmly and gives the seed somewhere else to go.
  const pillar = nearestScalePitchClass(nonRoot, root, random.pick(STRONG_INTERVALS));
  const remaining = nonRoot.filter((pitchClass) => pitchClass !== pillar);
  const secondaryAnchor = remaining.length > 0 ? random.pick(remaining) : pillar;
  const colors = remaining.filter((pitchClass) => pitchClass !== secondaryAnchor);
  const rare = colors.length > 1 ? [colors[colors.length - 1]!] : [];

  return {
    root,
    anchors: unique([root, pillar, secondaryAnchor]),
    colors: colors.filter((pitchClass) => !rare.includes(pitchClass)),
    rare,
  };
}

function createInitialVoicing(
  recipe: GenerationRecipe,
  hierarchy: PitchHierarchy,
  allowedPitches: readonly number[],
): number[] {
  const voiceRanges = [[34, 48], [38, 57], [43, 68], [48, 78]] as const;
  const voices = voiceRanges.map(([minimum, maximum]) =>
    allowedPitches.filter((pitch) => pitch >= minimum && pitch <= maximum),
  );
  const targetSpacing = 2.5 + recipe.parameters.space * 10.5;
  const targetSpan = 8 + recipe.parameters.space * 29;
  const targetTension = 0.04 + recipe.parameters.tension * 0.5;
  const random = createRandom(deriveSeed(recipe.seed, "initial-voicing"));
  const pool: ScoredVoicing[] = [];

  for (const bass of voices[0]!) {
    for (const lowMid of voices[1]!) {
      if (lowMid <= bass) continue;
      for (const highMid of voices[2]!) {
        if (highMid <= lowMid) continue;
        for (const high of voices[3]!) {
          if (high <= highMid) continue;
          const candidate = [bass, lowMid, highMid, high];
          const pitchClasses = candidate.map((pitch) => pitch % 12);
          const anchorCount = pitchClasses.filter((pitchClass) =>
            hierarchy.anchors.includes(pitchClass),
          ).length;
          const colorCount = pitchClasses.filter((pitchClass) =>
            hierarchy.colors.includes(pitchClass),
          ).length;
          const rareCount = pitchClasses.filter((pitchClass) =>
            hierarchy.rare.includes(pitchClass),
          ).length;
          const span = high - bass;
          // Split deliberately. `fit` is how well the voicing answers the
          // macros; `colour` is which harmonic material it uses. Diversity is
          // taken from colour alone, because widening the window on fit would
          // let the seed drift off the Space and Tension targets and blunt the
          // very controls the artist is holding.
          const tensionFit = Math.abs(measureTension(candidate) - targetTension);
          const shapeFit =
            spacingDeviation(candidate, targetSpacing) * 0.72 +
            Math.abs(span - targetSpan) * 0.22;
          const colour =
            (pitchClasses.includes(hierarchy.root) ? 1.2 : -0.6) +
            anchorCount * (0.55 - recipe.parameters.tension * 0.3) +
            colorCount * recipe.parameters.tension * 0.25 +
            rareCount * recipe.parameters.tension * 0.45;

          rememberVoicing(
            pool,
            candidate,
            colour - shapeFit - tensionFit * 8,
            tensionFit,
          );
        }
      }
    }
  }

  const best = pool[0];
  if (best === undefined) {
    throw new Error("Unable to create a scale-valid initial voicing.");
  }

  // Taking the argmax made the whole Composition Plan very nearly
  // seed-invariant: four Foundation voicings across two hundred seeds, and
  // every Scene departs from this one chord. Sampling from the candidates that
  // score close to the best keeps the quality floor while giving each seed its
  // own harmonic world. Widening the score jitter instead would only have added
  // noise to a musical judgement.
  // Diversity is taken from harmonic colour, register and spacing — never from
  // how well the voicing answers Tension. That deviation is held to a narrow
  // band around the best available, so sampling cannot blunt the macro the
  // artist is holding.
  const closestFit = Math.min(...pool.map((entry) => entry.fit));
  const eligible = pool.filter((entry) =>
    entry.score >= best.score - VOICING_QUALITY_WINDOW
    && entry.fit <= closestFit + VOICING_TENSION_WINDOW,
  );
  return [...random.pick(eligible).pitches];
}

interface ScoredVoicing {
  readonly pitches: readonly number[];
  readonly score: number;
  readonly fit: number;
}

/** Keeps the best candidates in descending order, bounded so scoring stays cheap. */
function rememberVoicing(
  pool: ScoredVoicing[],
  pitches: readonly number[],
  score: number,
  fit: number,
): void {
  if (pool.length === VOICING_POOL_SIZE && score <= pool[pool.length - 1]!.score) {
    return;
  }
  const at = pool.findIndex((entry) => score > entry.score);
  pool.splice(at < 0 ? pool.length : at, 0, { pitches, score, fit });
  if (pool.length > VOICING_POOL_SIZE) pool.pop();
}

/**
 * A Scene opens on material that gravitates toward the Transition Anchors, so
 * that whichever Scene the artist launches next meets this one on shared
 * pitch-class ground rather than at an arbitrary voicing.
 */
function createSceneVariation(
  foundation: readonly number[],
  scene: SceneKind,
  allowedPitches: readonly number[],
  transitionAnchors: readonly number[],
  random: RandomSource,
): number[] {
  const candidates = mutateState(foundation, allowedPitches, scene === "tension" ? 2 : 1);
  if (candidates.length === 0) {
    return [...foundation];
  }

  const preferredVoice = scene === "release" ? 1 : scene === "tension" ? 2 : 3;
  const preferred = candidates.filter(
    (candidate) => candidate[preferredVoice] !== foundation[preferredVoice],
  );
  const pool = preferred.length > 0 ? preferred : candidates;
  return [...random.pick(richestInAnchors(pool, transitionAnchors))];
}

function createPath(
  recipe: GenerationRecipe,
  hierarchy: PitchHierarchy,
  transitionAnchors: readonly number[],
  scene: SceneKind,
  start: readonly number[],
  allowedPitches: readonly number[],
  random: RandomSource,
): HarmonicPath {
  const [minimum, maximum] = PAD_MUTATION_RANGES[scene];
  const mutationCount = resolveCount(
    minimum,
    maximum,
    recipe.parameters.motion,
    recipe.seed,
    `path-mutations:${scene}`,
  );
  const times = createMutationTimes(mutationCount, random);
  let beam: PathCandidate[] = [{ states: [[...start]], score: 0 }];

  for (let step = 0; step < mutationCount; step += 1) {
    const isLast = step === mutationCount - 1;
    const expanded = beam.flatMap((candidate) =>
      mutateState(
        candidate.states[candidate.states.length - 1]!,
        allowedPitches,
        1 + Math.floor(recipe.parameters.motion * 3),
      ).map((state) => ({
        states: [...candidate.states, state],
        score:
          candidate.score +
          scoreTransition(
            recipe,
            hierarchy,
            transitionAnchors,
            scene,
            candidate.states[candidate.states.length - 1]!,
            state,
            start,
            isLast,
          ) +
          random.next() * 0.08,
      })),
    );

    beam = expanded
      .sort((left, right) => right.score - left.score)
      .slice(0, BEAM_WIDTH);
  }

  const winner = beam[0] ?? { states: [[...start]], score: 0 };
  const events: HarmonicEvent[] = winner.states.map((pitches, index) => ({
    beat: index === 0 ? 0 : times[index - 1]!,
    pitches,
  }));
  return { scene, events };
}

function createMutationTimes(count: number, random: RandomSource): number[] {
  const available = [4, 6, 9, 12, 15, 18, 21, 24, 27, 29];
  const selected: number[] = [];
  while (selected.length < count && available.length > 0) {
    const index = random.integer(0, available.length - 1);
    selected.push(available.splice(index, 1)[0]!);
  }
  return selected.sort((left, right) => left - right);
}

function mutateState(
  state: readonly number[],
  allowedPitches: readonly number[],
  maximumScaleSteps: number,
): number[][] {
  const candidates: number[][] = [];
  for (let voice = 0; voice < state.length; voice += 1) {
    const currentIndex = allowedPitches.indexOf(state[voice]!);
    for (let scaleSteps = 1; scaleSteps <= maximumScaleSteps; scaleSteps += 1) {
      for (const direction of [-1, 1] as const) {
        const pitch = allowedPitches[currentIndex + scaleSteps * direction];
        if (pitch === undefined) continue;
        const next = [...state];
        next[voice] = pitch;
        if (isOrdered(next) && isInVoiceRegister(voice, pitch)) candidates.push(next);
      }
    }
  }
  return candidates;
}

function scoreTransition(
  recipe: GenerationRecipe,
  hierarchy: PitchHierarchy,
  transitionAnchors: readonly number[],
  scene: SceneKind,
  previous: readonly number[],
  candidate: readonly number[],
  start: readonly number[],
  isLast: boolean,
): number {
  const movement = totalMovement(previous, candidate);
  const commonTones = countCommonTones(previous, candidate);
  const spacing = averageSpacing(candidate);
  const targetSpacing = 4 + recipe.parameters.space * 8;
  const sceneTension = clamp(
    recipe.parameters.tension + SCENE_TENSION_OFFSET[scene], 0, 1,
  );
  const targetTension = 0.04 + sceneTension * 0.5;
  const pitchClasses = candidate.map((pitch) => pitch % 12);
  const anchorCount = pitchClasses.filter((pitchClass) =>
    hierarchy.anchors.includes(pitchClass),
  ).length;
  const colorCount = pitchClasses.filter((pitchClass) =>
    hierarchy.colors.includes(pitchClass),
  ).length;
  const rareCount = pitchClasses.filter((pitchClass) =>
    hierarchy.rare.includes(pitchClass),
  ).length;
  const rootBonus = scene === "foundation" || scene === "release"
    ? pitchClasses.includes(hierarchy.root) ? 0.7 : -0.35
    : 0;
  const loopScore = isLast
    ? countCommonTones(start, candidate) * 0.7 - totalMovement(start, candidate) * 0.08
    : 0;
  // The closing region gravitates toward the Transition Anchors, so the Scene
  // hands over compatibly to whichever Scene is launched next.
  const boundaryGravity = isLast
    ? transitionAnchorCount(candidate, transitionAnchors) * TRANSITION_ANCHOR_WEIGHT
    : 0;

  return (
    commonTones * 0.8 +
    anchorCount * (0.28 - recipe.parameters.tension * 0.18) +
    colorCount * recipe.parameters.tension * 0.12 +
    rareCount * recipe.parameters.tension * 0.24 +
    rootBonus +
    loopScore +
    boundaryGravity -
    Math.abs(movement - (1 + recipe.parameters.motion * 7)) * 0.34 -
    spacingDeviation(candidate, targetSpacing) * 0.52 -
    Math.abs(measureTension(candidate) - targetTension) * 5.5
  );
}

export function createAllowedPitches(
  recipe: GenerationRecipe,
  minimum: number,
  maximum: number,
): number[] {
  const { rootPitchClass, scale } = recipe.parameters;
  const pitchClasses = new Set(
    scale.intervals.map((interval) => (rootPitchClass + interval) % 12),
  );
  const result: number[] = [];
  for (let pitch = minimum; pitch <= maximum; pitch += 1) {
    if (pitchClasses.has(pitch % 12)) result.push(pitch);
  }
  return result;
}

function isOrdered(pitches: readonly number[]): boolean {
  return pitches.every((pitch, index) => index === 0 || pitch > pitches[index - 1]!);
}

function isInVoiceRegister(voice: number, pitch: number): boolean {
  const ranges = [[34, 50], [41, 58], [48, 67], [55, 78]] as const;
  const [minimum, maximum] = ranges[voice] ?? [34, 78];
  return pitch >= minimum && pitch <= maximum;
}

export function measureTension(pitches: readonly number[]): number {
  const weights: Readonly<Record<number, number>> = {
    0: 0.1, 1: 1, 2: 0.62, 3: 0.24, 4: 0.18, 5: 0.12,
    6: 0.9, 7: 0.08, 8: 0.22, 9: 0.2, 10: 0.55, 11: 0.82,
  };
  let total = 0;
  let pairs = 0;
  for (let left = 0; left < pitches.length; left += 1) {
    for (let right = left + 1; right < pitches.length; right += 1) {
      const distance = Math.abs(pitches[right]! - pitches[left]!);
      total += (weights[distance % 12] ?? 0) * Math.exp(-0.025 * distance);
      pairs += 1;
    }
  }
  return pairs === 0 ? 0 : total / pairs;
}

export function totalMovement(left: readonly number[], right: readonly number[]): number {
  return left.reduce(
    (total, pitch, index) => total + Math.abs(pitch - (right[index] ?? pitch)), 0,
  );
}

export function countCommonTones(left: readonly number[], right: readonly number[]): number {
  return left.filter((pitch, index) => pitch === right[index]).length;
}

export function averageSpacing(pitches: readonly number[]): number {
  if (pitches.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < pitches.length; index += 1) {
    total += pitches[index]! - pitches[index - 1]!;
  }
  return total / (pitches.length - 1);
}

function spacingDeviation(pitches: readonly number[], target: number): number {
  if (pitches.length < 2) return 0;
  let total = 0;
  for (let index = 1; index < pitches.length; index += 1) {
    total += Math.abs(pitches[index]! - pitches[index - 1]! - target);
  }
  return total / (pitches.length - 1);
}

/** Degrees stable enough to anchor a world: the fifth, the fourth, the sixth. */
const STRONG_INTERVALS = [7, 5, 9] as const;

function nearestScalePitchClass(
  candidates: readonly number[],
  root: number,
  interval: number,
): number {
  const target = (root + interval) % 12;
  return candidates.reduce(
    (best, pitchClass) =>
      circularDistance(pitchClass, target) < circularDistance(best, target)
        ? pitchClass
        : best,
    candidates[0] ?? root,
  );
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 12 - distance);
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
