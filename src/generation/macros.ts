import { deriveSeed } from "./random";

/**
 * Macro positions are continuous, but most of what they drive is a count of
 * events or voices. Rounding a count with fixed thresholds turns a slider into
 * a three-position switch, so counts are resolved by deterministic stochastic
 * rounding instead: the fractional part becomes the chance that this particular
 * lane, scene or contour rounds up. Identical recipes still produce identical
 * scores, because the coin is a hash of the seed and a stable label rather than
 * a random draw.
 */
export function resolveCount(
  minimum: number,
  maximum: number,
  macro: number,
  seed: number,
  label: string,
): number {
  const exact = minimum + (maximum - minimum) * clampUnit(macro);
  const floor = Math.floor(exact);
  const fraction = exact - floor;
  if (fraction <= 0) return floor;
  return floor + (macroUnit(seed, label) < fraction ? 1 : 0);
}

/**
 * A stable value in [0, 1) for one seed and label. FNV-1a alone leaves the high
 * bits correlated for the short, similar labels used here, which biases every
 * rounded count low; the finalizer avalanches them back to uniform.
 */
export function macroUnit(seed: number, label: string): number {
  let hash = deriveSeed(seed, label);
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 0) / 0x1_0000_0000;
}

/** Drift is optional in the recipe; absent means the plan is followed exactly. */
export function driftOf(parameters: { readonly drift?: number }): number {
  return clampUnit(parameters.drift ?? 0);
}

export function interpolate(minimum: number, maximum: number, macro: number): number {
  return minimum + (maximum - minimum) * clampUnit(macro);
}

/**
 * How much of the time until the next event a sustained note actually sounds.
 * Space opens the texture by releasing early: at 0 the roles overlap into one
 * continuous wall, at 1 they breathe.
 */
export function spaceGate(space: number, mostOpen = 0.52): number {
  return interpolate(1, mostOpen, space);
}

function clampUnit(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}
