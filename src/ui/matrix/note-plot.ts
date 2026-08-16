import type { GeneratedLane, GeneratedNote } from "../../generation/types";

/**
 * Geometry for the shared-axis matrix preview. Every plot is drawn in its own
 * viewBox units so that a note keeps a comparable thickness whether it appears
 * in a short lane row or in the tall stacked Scene view.
 */
export interface PlotBox {
  readonly width: number;
  readonly height: number;
}

export interface PitchRange {
  readonly low: number;
  readonly high: number;
}

export interface VelocityRange {
  readonly softest: number;
  readonly loudest: number;
}

/**
 * Opacity carries velocity, so it has to be scaled against what the matrix
 * actually contains. Measuring against the full MIDI range instead left every
 * note between 0.61 and 0.83 — a 22% spread that reads as one flat shade.
 */
export function velocityRangeOf(lanes: readonly GeneratedLane[]): VelocityRange {
  let softest = Number.POSITIVE_INFINITY;
  let loudest = Number.NEGATIVE_INFINITY;

  for (const lane of lanes) {
    for (const scene of lane.scenes) {
      for (const note of scene.notes) {
        if (note.velocity < softest) softest = note.velocity;
        if (note.velocity > loudest) loudest = note.velocity;
      }
    }
  }

  if (softest > loudest) return { softest: 0, loudest: 127 };
  // A matrix at one dynamic should read as one shade, not as full contrast.
  return loudest - softest < MIN_VELOCITY_SPREAD
    ? { softest, loudest: softest + MIN_VELOCITY_SPREAD }
    : { softest, loudest };
}

/** One lane's contribution to a plot; several series stack on a shared axis. */
export interface PlotSeries {
  readonly id: string;
  /** Musical Role, so overlaid lanes can be told apart by ink. */
  readonly role: string;
  readonly notes: readonly GeneratedNote[];
  readonly dimmed: boolean;
}

export interface NoteRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}

export const LANE_PLOT_BOX: PlotBox = { width: 100, height: 52 };
export const STACK_PLOT_BOX: PlotBox = { width: 100, height: 420 };

const MIN_SPAN = 12;
const RANGE_PADDING = 1;
/** Keeps the lowest and highest notes off the cell border, where they would
 *  otherwise be mistaken for the rule between two lanes. */
const PLOT_INSET = 2;
const MIN_NOTE_WIDTH = 0.9;
const MIN_NOTE_HEIGHT = 2.6;
const MAX_NOTE_HEIGHT = 5;
const NOTE_HEIGHT_RATIO = 0.72;
const MIN_OPACITY = 0.32;
const MIN_VELOCITY_SPREAD = 24;

/**
 * The pitch window shared by every cell of the matrix. Reading orchestration
 * across lanes depends on one axis, so the range spans all lanes and scenes.
 */
export function pitchRangeOf(lanes: readonly GeneratedLane[]): PitchRange {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;

  for (const lane of lanes) {
    for (const scene of lane.scenes) {
      for (const note of scene.notes) {
        if (note.pitch < low) low = note.pitch;
        if (note.pitch > high) high = note.pitch;
      }
    }
  }

  if (low > high) {
    return { low: 60 - MIN_SPAN / 2, high: 60 + MIN_SPAN / 2 };
  }

  return widenToMinimumSpan(low - RANGE_PADDING, high + RANGE_PADDING);
}

export function noteRects(
  notes: readonly GeneratedNote[],
  range: PitchRange,
  durationBeats: number,
  box: PlotBox,
  velocities: VelocityRange = { softest: 0, loudest: 127 },
): readonly NoteRect[] {
  const span = range.high - range.low;
  const height = noteHeight(range, box);
  const usableHeight = Math.max(box.height - PLOT_INSET * 2, height);

  return notes.map((note) => {
    const width = clamp(
      (note.duration / durationBeats) * box.width,
      MIN_NOTE_WIDTH,
      box.width,
    );
    const x = clamp(
      (note.startTime / durationBeats) * box.width,
      0,
      box.width - width,
    );
    const position = clamp((note.pitch - range.low) / span, 0, 1);

    return {
      x: round(x),
      y: round(PLOT_INSET + (1 - position) * (usableHeight - height)),
      width: round(width),
      height: round(height),
      opacity: round(opacityFor(note.velocity, velocities)),
    };
  });
}

export function noteHeight(range: PitchRange, box: PlotBox): number {
  const perSemitone = box.height / (range.high - range.low);
  return clamp(perSemitone * NOTE_HEIGHT_RATIO, MIN_NOTE_HEIGHT, MAX_NOTE_HEIGHT);
}

/** Horizontal rules at every C, so the shared axis is readable without labels. */
export function octaveLines(range: PitchRange, box: PlotBox): readonly number[] {
  const span = range.high - range.low;
  const lines: number[] = [];

  for (
    let pitch = Math.ceil(range.low / 12) * 12;
    pitch <= range.high;
    pitch += 12
  ) {
    lines.push(round((1 - (pitch - range.low) / span) * box.height));
  }

  return lines;
}

/** Interior bar divisions of one Scene Cycle. */
export function barLines(
  durationBeats: number,
  box: PlotBox,
  beatsPerBar = 4,
): readonly number[] {
  const lines: number[] = [];

  for (let beat = beatsPerBar; beat < durationBeats; beat += beatsPerBar) {
    lines.push(round((beat / durationBeats) * box.width));
  }

  return lines;
}

function widenToMinimumSpan(low: number, high: number): PitchRange {
  const span = high - low;
  if (span >= MIN_SPAN) return { low, high };

  const growth = (MIN_SPAN - span) / 2;
  return { low: low - growth, high: high + growth };
}

function opacityFor(velocity: number, velocities: VelocityRange): number {
  const span = velocities.loudest - velocities.softest;
  const normalized = clamp((velocity - velocities.softest) / span, 0, 1);
  return MIN_OPACITY + normalized * (1 - MIN_OPACITY);
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
