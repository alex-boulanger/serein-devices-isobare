import { createRandom, deriveSeed } from "../random";
import type {
  GenerationRecipe,
  MelodicMotif,
  PitchHierarchy,
} from "../types";

/**
 * A line that sings is mostly stepwise, holds a direction for a few notes, and
 * has one high point to arrive at. The fixed contour table did none of that: it
 * reversed direction on 55% of notes and leapt a fifth or more on 20% of them,
 * which is what made the Lead wander instead of going somewhere.
 */
const STEP_PROBABILITY = 0.68;
const THIRD_PROBABILITY = 0.86;
const COUNTER_MOTION_PROBABILITY = 0.22;

/**
 * Gaps a Melodic Motif may put between its onsets. Building the rhythm from
 * these rather than choosing one of a fixed handful is what stops every seed
 * reusing the same eight phrases; six gaps across five steps is 7,776 shapes
 * where the table held eight.
 */
const MOTIF_GAPS = [1, 1.5, 2, 2.5, 3, 3.5] as const;
const MOTIF_ONSETS = 6;

export function createMelodicMotif(
  recipe: GenerationRecipe,
  hierarchy: PitchHierarchy,
): MelodicMotif {
  const contourSeed = deriveSeed(recipe.seed, "melodic-motif:contour");
  const rhythmSeed = deriveSeed(recipe.seed, "melodic-motif:rhythm");
  const scalePitchClasses = recipe.parameters.scale.intervals.map(
    (interval) => (recipe.parameters.rootPitchClass + interval) % 12,
  );
  const anchorDegrees = hierarchy.anchors
    .map((pitchClass) => scalePitchClasses.indexOf(pitchClass))
    .filter((degree) => degree >= 0);
  const start = anchorDegrees[contourSeed % Math.max(1, anchorDegrees.length)] ?? 0;
  const scaleDegrees = createContour(contourSeed, start, MOTIF_ONSETS - 1);

  return {
    scaleDegrees,
    rhythm: createRhythm(rhythmSeed),
  };
}

/**
 * Walks up to a high point and back down, mostly by step, with occasional
 * counter-motion so the arc does not feel mechanical. Never repeats a degree:
 * a lead that restates the same note is what reads as thin.
 */
function createContour(seed: number, start: number, steps: number): number[] {
  const random = createRandom(seed);
  const peak = random.integer(Math.max(1, Math.round(steps * 0.4)), Math.round(steps * 0.75));
  const degrees = [start];

  for (let index = 0; index < steps; index += 1) {
    const roll = random.next();
    const size = roll < STEP_PROBABILITY ? 1 : roll < THIRD_PROBABILITY ? 2 : 3;
    const rising = index < peak;
    const against = random.next() < COUNTER_MOTION_PROBABILITY;
    const direction = (rising ? 1 : -1) * (against ? -1 : 1);
    degrees.push(degrees[index]! + size * direction);
  }
  return degrees;
}

/** Onsets accumulated from seeded gaps, always starting on the phrase's first beat. */
function createRhythm(seed: number): number[] {
  const random = createRandom(seed);
  const onsets = [0];
  for (let index = 1; index < MOTIF_ONSETS; index += 1) {
    onsets.push(onsets[index - 1]! + random.pick(MOTIF_GAPS));
  }
  return onsets;
}
