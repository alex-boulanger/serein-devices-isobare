import { describe, expect, it } from "bun:test";

import {
  generate,
  type GenerationRecipe,
  type LeadStyle,
} from "../../src/generation/generate";

function recipe(style: LeadStyle, seed = 42): GenerationRecipe {
  return {
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.5,
      tension: 0.45,
      space: 0.65,
    },
    lanes: [{
      id: "lead",
      role: "lead",
      style,
      octaveOffset: 0,
      enabled: true,
    }],
  };
}

describe("Lead", () => {
  it("plans one deterministic whole-phrase Melodic Motif", () => {
    const first = generate(recipe("pluck", 17));
    const repeated = generate(recipe("pluck", 17));
    const different = generate(recipe("pluck", 18));

    expect(first.plan.melodicMotif).toEqual(repeated.plan.melodicMotif);
    expect(first.plan.melodicMotif).not.toEqual(different.plan.melodicMotif);
    expect(first.plan.melodicMotif.scaleDegrees).toHaveLength(6);
    expect(first.plan.melodicMotif.rhythm).toHaveLength(6);
  });

  it("transforms recognizable sparse material across the Scene Arc", () => {
    const result = generate(recipe("pluck", 29));
    const [foundation, development, tension, release] = result.lanes[0]!.scenes;
    const motifPitchClasses = new Set(result.plan.melodicMotif.scaleDegrees.map((degree) =>
      pitchClassForDegree(result.recipe, degree)
    ));

    expect(foundation!.notes.length).toBeGreaterThanOrEqual(3);
    expect(development!.notes.length).toBeGreaterThan(foundation!.notes.length);
    expect(tension!.notes.length).toBeGreaterThan(development!.notes.length);
    expect(release!.notes.length).toBeLessThan(development!.notes.length);

    for (const scene of result.lanes[0]!.scenes) {
      expect(scene.notes.length).toBeGreaterThan(0);
      expect(scene.notes[0]!.startTime).toBeLessThanOrEqual(4);
      expect(new Set(scene.notes.map((note) => note.pitch % 12))
        .size).toBeGreaterThanOrEqual(2);
      expect(scene.notes.filter((note) => motifPitchClasses.has(note.pitch % 12)).length)
        .toBeGreaterThanOrEqual(2);
    }
    expect(averagePitch(tension!.notes)).toBeGreaterThan(averagePitch(release!.notes) + 4);
  });

  it("keeps every Scene monophonic, in scale, and deliberately spacious", () => {
    const input = recipe("pluck", 31);
    const scenes = generate(input).lanes[0]!.scenes;

    for (const scene of scenes) {
      const ordered = [...scene.notes].sort((left, right) => left.startTime - right.startTime);
      for (let index = 1; index < ordered.length; index += 1) {
        const previous = ordered[index - 1]!;
        expect(previous.startTime + previous.duration)
          .toBeLessThan(ordered[index]!.startTime);
      }
      expect(scene.notes.every((note) => input.parameters.scale.intervals.includes(
        (note.pitch - input.parameters.rootPitchClass + 120) % 12,
      ))).toBe(true);
      expect(scene.notes.length).toBeLessThanOrEqual(12);
    }
  });

  it("uses Pluck and Flow as articulation styles of the same score", () => {
    const pluck = generate(recipe("pluck", 37)).lanes[0]!.scenes;
    const flow = generate(recipe("flow", 37)).lanes[0]!.scenes;

    expect(flow.map(scoreSignature)).toEqual(pluck.map(scoreSignature));
    expect(totalDuration(flow)).toBeGreaterThan(totalDuration(pluck) * 2);
  });

  it("responds strongly to Motion, Tension, and Space", () => {
    const base = recipe("pluck", 41);
    const withParameter = (
      parameter: "motion" | "tension" | "space",
      value: number,
    ) => generate({
      ...base,
      parameters: { ...base.parameters, [parameter]: value },
    });

    const lowMotion = withParameter("motion", 0);
    const highMotion = withParameter("motion", 1);
    expect(noteCount(highMotion)).toBeGreaterThan(noteCount(lowMotion) * 1.35);

    const lowTension = withParameter("tension", 0).lanes[0]!.scenes[2]!;
    const highTension = withParameter("tension", 1).lanes[0]!.scenes[2]!;
    expect(averagePitch(highTension.notes)).toBeGreaterThan(averagePitch(lowTension.notes) + 8);

    // Space opens the phrase, so the same contour gives time back as silence.
    // This previously asserted the opposite and pinned the inversion in place.
    const lowSpace = withParameter("space", 0).lanes[0]!.scenes;
    const highSpace = withParameter("space", 1).lanes[0]!.scenes;
    expect(totalDuration(highSpace)).toBeLessThan(totalDuration(lowSpace) * 0.7);
    expect(silentBeats(highSpace)).toBeGreaterThan(silentBeats(lowSpace));
  });
});

function pitchClassForDegree(recipe: GenerationRecipe, degree: number): number {
  const intervals = recipe.parameters.scale.intervals;
  const normalized = ((degree % intervals.length) + intervals.length) % intervals.length;
  return (recipe.parameters.rootPitchClass + intervals[normalized]!) % 12;
}

function averagePitch(notes: readonly { readonly pitch: number }[]): number {
  return notes.reduce((total, note) => total + note.pitch, 0) / notes.length;
}

function scoreSignature(
  scene: ReturnType<typeof generate>["lanes"][number]["scenes"][number],
): string {
  return scene.notes.map((note) => `${note.startTime}:${note.pitch}:${note.velocity}`).join("|");
}

function totalDuration(
  scenes: readonly ReturnType<typeof generate>["lanes"][number]["scenes"][number][],
): number {
  return scenes.reduce(
    (total, scene) => total + scene.notes.reduce(
      (sceneTotal, note) => sceneTotal + note.duration,
      0,
    ),
    0,
  );
}

function silentBeats(
  scenes: readonly ReturnType<typeof generate>["lanes"][number]["scenes"][number][],
): number {
  return scenes.reduce(
    (total, scene) => total + 32 - scene.notes.reduce(
      (sounding, note) => sounding + note.duration,
      0,
    ),
    0,
  );
}

function noteCount(result: ReturnType<typeof generate>): number {
  return result.lanes[0]!.scenes.reduce(
    (total, scene) => total + scene.notes.length,
    0,
  );
}
