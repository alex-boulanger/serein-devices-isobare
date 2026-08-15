import { describe, expect, it } from "bun:test";

import {
  generate,
  type GenerationRecipe,
} from "../../src/generation/generate";

function recipe(seed: number): GenerationRecipe {
  return {
    engineVersion: 4,
    seed,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.5,
      tension: 0.45,
      space: 0.65,
    },
    lanes: [{ id: "bass", role: "bass", octaveOffset: 0, enabled: true }],
  };
}

describe("Bass articulation", () => {
  it("transforms one seeded Articulation Motif across Scenes", () => {
    const lane = generate(recipe(17)).lanes[0]!;
    const attackRanges = [[1, 2], [2, 4], [2, 5], [1, 3]] as const;

    expect(lane.identity.articulationFamily).toBeDefined();
    lane.scenes.forEach((scene, index) => {
      expect(scene.notes.length).toBeGreaterThanOrEqual(attackRanges[index]![0]);
      expect(scene.notes.length).toBeLessThanOrEqual(attackRanges[index]![1]);
      expect(scene.notes[0]!.startTime).toBe(0);
      expect(scene.notes.some((note) => note.startTime + note.duration < 32)).toBe(true);
    });
    expect(new Set(lane.scenes.map(noteOnsetSignature)).size).toBeGreaterThan(1);
  });

  it("produces structurally diverse motifs across seeds", () => {
    const signatures = new Set(Array.from({ length: 20 }, (_, seed) => {
      const lane = generate(recipe(seed + 1)).lanes[0]!;
      return `${lane.identity.articulationFamily}:${lane.scenes
        .map(noteOnsetSignature)
        .join("|")}`;
    }));
    expect(signatures.size).toBeGreaterThanOrEqual(8);
  });

  it("lets Motion reshape articulation independently of Harmonic Events", () => {
    const input = recipe(29);
    const low = generate({
      ...input,
      parameters: { ...input.parameters, motion: 0 },
    });
    const high = generate({
      ...input,
      parameters: { ...input.parameters, motion: 1 },
    });
    const lowAttacks = countAttacks(low);
    const highAttacks = countAttacks(high);
    const harmonicBeats = new Set(
      high.plan.paths.flatMap((path) => path.events.map((event) => event.beat)),
    );

    expect(highAttacks).toBeGreaterThan(lowAttacks * 1.5);
    expect(high.lanes[0]!.scenes.some((scene) =>
      scene.notes.some((note) => !harmonicBeats.has(note.startTime)),
    )).toBe(true);
  });

  it("makes siblings rhythmically distinct but independently complete", () => {
    const input = recipe(19);
    const result = generate({
      ...input,
      lanes: [
        { id: "bass-a", role: "bass", octaveOffset: 0, enabled: true },
        { id: "bass-b", role: "bass", octaveOffset: 0, enabled: true },
      ],
    });
    const [first, second] = result.lanes;

    expect(first!.identity.articulationFamily)
      .not.toBe(second!.identity.articulationFamily);
    expect(first!.scenes.every((scene) => scene.notes.length > 0)).toBe(true);
    expect(second!.scenes.every((scene) => scene.notes.length > 0)).toBe(true);
    expect(first!.scenes.map(noteOnsetSignature))
      .not.toEqual(second!.scenes.map(noteOnsetSignature));
  });
});

function noteOnsetSignature(
  scene: ReturnType<typeof generate>["lanes"][number]["scenes"][number],
): string {
  return scene.notes.map((note) => note.startTime).join(",");
}

function countAttacks(result: ReturnType<typeof generate>): number {
  return result.lanes[0]!.scenes.reduce(
    (total, scene) => total + scene.notes.length,
    0,
  );
}
