import { describe, expect, it } from "bun:test";

import {
  generate,
  SCENE_KINDS,
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
    lanes: [{ id: "pad", role: "pad", octaveOffset: 0, enabled: true }],
  };
}

describe("matrix orchestration", () => {
  it("budgets density by Role Family rather than raw variant count", () => {
    const base = recipe(23);
    const single = generate({
      ...base,
      lanes: [{ id: "pad-a", role: "pad", octaveOffset: 0, enabled: true }],
    });
    const variants = generate({
      ...base,
      lanes: [
        { id: "pad-a", role: "pad", octaveOffset: 0, enabled: true },
        { id: "pad-b", role: "pad", octaveOffset: 0, enabled: true },
      ],
    });
    const moreFamilies = generate({
      ...base,
      lanes: [
        { id: "pad-a", role: "pad", octaveOffset: 0, enabled: true },
        { id: "drone", role: "drone", octaveOffset: 0, enabled: true },
        { id: "bass", role: "bass", octaveOffset: 0, enabled: true },
        { id: "arp", role: "arp-source", octaveOffset: 0, enabled: true },
      ],
    });

    expect(variants.lanes[0]!.scenes).toEqual(single.lanes[0]!.scenes);
    expect(totalVoiceBeats(moreFamilies.lanes[0]!.scenes))
      .toBeLessThan(totalVoiceBeats(single.lanes[0]!.scenes));
  });

  it("assigns stable complementary identities and sibling paths to Role Variants", () => {
    const input = recipe(31);
    const result = generate({
      ...input,
      lanes: [
        { id: "pad-a", role: "pad", octaveOffset: 0, enabled: true },
        { id: "pad-b", role: "pad", octaveOffset: 0, enabled: true },
      ],
    });
    const [first, second] = result.lanes;

    expect(first!.identity.name).not.toBe(second!.identity.name);
    expect(first!.identity.registerOffset).not.toBe(second!.identity.registerOffset);
    for (let index = 0; index < 4; index += 1) {
      const basePitches = first!.harmonicPaths[index]!.events[0]!.pitches;
      const siblingPitches = second!.harmonicPaths[index]!.events[0]!.pitches;
      expect(siblingPitches.filter((pitch) => basePitches.includes(pitch)).length)
        .toBeGreaterThanOrEqual(3);
      expect(siblingPitches).not.toEqual(basePitches);
    }
  });

  it("creates distinct matrix-level Scene Profiles", () => {
    const input = recipe(37);
    const result = generate({
      ...input,
      lanes: [
        { id: "bass", role: "bass", octaveOffset: 0, enabled: true },
        { id: "pad", role: "pad", octaveOffset: 0, enabled: true },
        { id: "drone", role: "drone", octaveOffset: 0, enabled: true },
        { id: "arp", role: "arp-source", octaveOffset: 0, enabled: true },
      ],
    });
    const voiceBeats = SCENE_KINDS.map((_scene, sceneIndex) =>
      result.lanes.reduce(
        (total, lane) => total + totalVoiceBeats([lane.scenes[sceneIndex]!]),
        0,
      ),
    );

    expect(new Set(voiceBeats).size).toBeGreaterThanOrEqual(3);
    expect(voiceBeats[2]).toBeGreaterThan(voiceBeats[0]!);
    expect(voiceBeats[2]).toBeGreaterThan(voiceBeats[3]!);
  });
});

function totalVoiceBeats(
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
