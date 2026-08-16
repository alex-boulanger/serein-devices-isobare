import { describe, expect, it } from "bun:test";

import {
  generate,
  type BassStyle,
  type GenerationRecipe,
} from "../../src/generation/generate";

function recipe(style: BassStyle): GenerationRecipe {
  return {
    engineVersion: 6,
    seed: 73,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.5,
      tension: 0.45,
      space: 0.65,
    },
    lanes: [{ id: "bass", role: "bass", style, octaveOffset: 0, enabled: true }],
  };
}

describe("Bass Role Styles", () => {
  it("renders Sustained as continuous low harmonic support", () => {
    const lane = generate(recipe("sustained")).lanes[0]!;

    expect(lane.identity.articulationFamily).toBeUndefined();
    for (const scene of lane.scenes) {
      const ordered = [...scene.notes].sort((left, right) => left.startTime - right.startTime);
      expect(ordered[0]!.startTime).toBe(0);
      // Bounded by the widened Bass mutation budget; the contract under test is
      // that the notes are contiguous and cover the Scene Cycle, not the count.
      expect(ordered.length).toBeLessThanOrEqual(6);
      for (let index = 1; index < ordered.length; index += 1) {
        expect(ordered[index - 1]!.startTime + ordered[index - 1]!.duration)
          .toBe(ordered[index]!.startTime);
      }
      expect(ordered.at(-1)!.startTime + ordered.at(-1)!.duration).toBe(32);
    }
  });

  it("keeps Articulated and Sustained as different scores for one Bass role", () => {
    const articulated = generate(recipe("articulated")).lanes[0]!;
    const sustained = generate(recipe("sustained")).lanes[0]!;

    expect(articulated.identity.articulationFamily).toBeDefined();
    expect(articulated.scenes).not.toEqual(sustained.scenes);
    expect(articulated.scenes.some((scene) =>
      scene.notes.some((note) => note.startTime > 0)
    )).toBe(true);
  });

  it("rejects missing and cross-role styles", () => {
    const input = recipe("articulated");
    const { style: _style, ...withoutStyle } = input.lanes[0]!;
    expect(() => generate({ ...input, lanes: [withoutStyle] }))
      .toThrow("supported Role Style");
    expect(() => generate({
      ...input,
      lanes: [{ ...input.lanes[0]!, style: "flow" }],
    })).toThrow("supported Role Style");
  });
});
