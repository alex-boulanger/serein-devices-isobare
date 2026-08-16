import { describe, expect, it } from "bun:test";

import { generate, type GenerationRecipe } from "../../src/generation/generate";
import type { GeneratedLane, GeneratedNote } from "../../src/generation/types";
import {
  LANE_PLOT_BOX,
  STACK_PLOT_BOX,
  barLines,
  noteHeight,
  noteRects,
  octaveLines,
  pitchRangeOf,
  type PlotBox,
} from "../../src/ui/matrix/note-plot";

const BOX: PlotBox = { width: 100, height: 50 };

function note(overrides: Partial<GeneratedNote> = {}): GeneratedNote {
  return { pitch: 60, startTime: 0, duration: 4, velocity: 100, ...overrides };
}

function lane(pitches: readonly number[]): GeneratedLane {
  return {
    id: "lane",
    role: "pad",
    roleInstance: 0,
    octaveOffset: 0,
    identity: { name: "aurora", registerOffset: 0, harmonicRotation: 0, stability: 0.5 },
    harmonicPaths: [],
    scenes: [{
      kind: "foundation",
      name: "Foundation",
      durationBeats: 32,
      notes: pitches.map((pitch) => note({ pitch })),
      metrics: {
        noteCount: pitches.length,
        mutationCount: 0,
        densityChangeCount: 0,
        averageMovement: 0,
        averageSpacing: 0,
        averageTension: 0,
      },
    }],
  };
}

describe("pitchRangeOf", () => {
  it("spans every lane so the matrix shares one axis", () => {
    const range = pitchRangeOf([lane([40, 52]), lane([72, 84])]);

    expect(range.low).toBe(39);
    expect(range.high).toBe(85);
  });

  it("widens a narrow range so a single note is not a full-height bar", () => {
    const range = pitchRangeOf([lane([60])]);

    expect(range.high - range.low).toBeGreaterThanOrEqual(12);
    expect((range.low + range.high) / 2).toBeCloseTo(60, 5);
  });

  it("falls back to a centred window when nothing is generated", () => {
    const range = pitchRangeOf([]);

    expect(range.high - range.low).toBe(12);
    expect((range.low + range.high) / 2).toBeCloseTo(60, 5);
  });
});

describe("noteRects", () => {
  const range = { low: 36, high: 84 };

  it("places higher pitches nearer the top", () => {
    const [low, high] = noteRects(
      [note({ pitch: 40 }), note({ pitch: 80 })],
      range,
      32,
      BOX,
    );

    expect(high!.y).toBeLessThan(low!.y);
  });

  it("keeps every note inside the box", () => {
    const rects = noteRects(
      [
        note({ pitch: 36, startTime: 0, duration: 32 }),
        note({ pitch: 84, startTime: 31, duration: 4 }),
      ],
      range,
      32,
      BOX,
    );

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(BOX.width);
      expect(rect.y + rect.height).toBeLessThanOrEqual(BOX.height);
    }
  });

  it("maps start and duration onto the Scene Cycle", () => {
    const [rect] = noteRects([note({ startTime: 8, duration: 8 })], range, 32, BOX);

    expect(rect!.x).toBe(25);
    expect(rect!.width).toBe(25);
  });

  it("keeps a very short note visible", () => {
    const [rect] = noteRects([note({ duration: 0.05 })], range, 32, BOX);

    expect(rect!.width).toBeGreaterThan(0.5);
  });

  it("reads velocity as opacity without letting a quiet note vanish", () => {
    const [quiet, loud] = noteRects(
      [note({ velocity: 1 }), note({ velocity: 127 })],
      range,
      32,
      BOX,
    );

    expect(quiet!.opacity).toBeGreaterThan(0.3);
    expect(loud!.opacity).toBe(1);
    expect(quiet!.opacity).toBeLessThan(loud!.opacity);
  });

  it("clamps out-of-range pitches rather than drawing outside the plot", () => {
    const [below, above] = noteRects(
      [note({ pitch: 12 }), note({ pitch: 120 })],
      range,
      32,
      BOX,
    );

    expect(below!.y + below!.height).toBeLessThanOrEqual(BOX.height);
    expect(above!.y).toBeGreaterThan(0);
  });

  it("insets the extremes so a note never sits on the lane border", () => {
    const rects = noteRects(
      [note({ pitch: range.low }), note({ pitch: range.high })],
      range,
      32,
      BOX,
    );

    for (const rect of rects) {
      expect(rect.y).toBeGreaterThanOrEqual(1);
      expect(BOX.height - (rect.y + rect.height)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("noteHeight", () => {
  it("stays legible in a lane row and proportional in the stacked view", () => {
    const range = { low: 33, high: 77 };

    expect(noteHeight(range, LANE_PLOT_BOX)).toBeGreaterThanOrEqual(2);
    expect(noteHeight(range, LANE_PLOT_BOX)).toBeLessThanOrEqual(8);
    expect(noteHeight(range, STACK_PLOT_BOX)).toBeGreaterThan(
      noteHeight(range, LANE_PLOT_BOX),
    );
  });
});

describe("grid lines", () => {
  it("rules an octave line at every C inside the range", () => {
    expect(octaveLines({ low: 48, high: 72 }, BOX)).toEqual([50, 25, 0]);
  });

  it("divides a Scene Cycle into interior bars", () => {
    expect(barLines(32, BOX)).toEqual([12.5, 25, 37.5, 50, 62.5, 75, 87.5]);
  });
});

describe("against real generated material", () => {
  const recipe: GenerationRecipe = {
    engineVersion: 6,
    seed: 4242,
    parameters: {
      rootPitchClass: 0,
      scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
      motion: 0.5,
      tension: 0.5,
      space: 0.5,
    },
    lanes: [
      { id: "a", role: "bass", octaveOffset: 0, enabled: true, style: "articulated" },
      { id: "b", role: "pad", octaveOffset: 0, enabled: true },
      { id: "c", role: "lead", octaveOffset: 0, enabled: true, style: "flow" },
    ],
  };

  it("draws every note of every scene inside its cell", () => {
    const result = generate(recipe);
    const range = pitchRangeOf(result.lanes);
    let drawn = 0;

    for (const generatedLane of result.lanes) {
      for (const scene of generatedLane.scenes) {
        for (const rect of noteRects(scene.notes, range, scene.durationBeats, LANE_PLOT_BOX)) {
          expect(rect.x + rect.width).toBeLessThanOrEqual(LANE_PLOT_BOX.width);
          expect(rect.y + rect.height).toBeLessThanOrEqual(LANE_PLOT_BOX.height);
          expect(rect.opacity).toBeGreaterThan(0);
          drawn += 1;
        }
      }
    }

    expect(drawn).toBe(result.metrics.noteCount);
  });

  it("separates registers, so bass sits below lead on the shared axis", () => {
    const result = generate(recipe);
    const range = pitchRangeOf(result.lanes);
    const centre = (id: string) => {
      const found = result.lanes.find((item) => item.id === id)!;
      const rects = found.scenes.flatMap((scene) =>
        noteRects(scene.notes, range, scene.durationBeats, LANE_PLOT_BOX),
      );
      return rects.reduce((total, rect) => total + rect.y, 0) / rects.length;
    };

    expect(centre("a")).toBeGreaterThan(centre("c"));
  });
});
