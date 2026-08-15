import { describe, expect, it } from "bun:test";

import {
  generate,
  MUSICAL_ROLES,
  SCENE_KINDS,
  type GenerationRecipe,
  type MusicalRole,
  type SceneKind,
} from "../../src/generation/generate";

function recipe(role: MusicalRole = "pad", seed = 42): GenerationRecipe {
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
    lanes: [{ id: "track-0", role, octaveOffset: 0, enabled: true }],
  };
}

const mutationRanges: Readonly<
  Record<MusicalRole, Readonly<Record<SceneKind, readonly [number, number]>>>
> = {
  bass: {
    foundation: [0, 1], development: [1, 2], tension: [1, 2], release: [0, 1],
  },
  pad: {
    foundation: [0, 1], development: [1, 2], tension: [2, 4], release: [0, 1],
  },
  drone: {
    foundation: [0, 0], development: [0, 1], tension: [1, 1], release: [0, 0],
  },
  "arp-source": {
    foundation: [0, 1], development: [1, 2], tension: [1, 3], release: [0, 1],
  },
};

describe("generate", () => {
  it("is deterministic for the same versioned recipe", () => {
    expect(generate(recipe())).toEqual(generate(recipe()));
    expect(generate(recipe())).not.toEqual(generate(recipe("pad", 43)));
  });

  it("creates four related 32-beat scenes", () => {
    const result = generate(recipe());
    expect(result.lanes[0]!.scenes.map((scene) => scene.kind)).toEqual([...SCENE_KINDS]);
    expect(result.metrics.sceneCount).toBe(4);
    for (const scene of result.lanes[0]!.scenes) {
      expect(scene.durationBeats).toBe(32);
      expect(scene.notes.length).toBeGreaterThan(0);
      expect(scene.notes.some((note) => note.startTime === 0)).toBe(true);
      expect(scene.notes.every((note) =>
        note.startTime >= 0 && note.duration > 0 && note.startTime + note.duration <= 32,
      )).toBe(true);
    }
  });

  it("keeps every role in scale and inside its mutation budget", () => {
    for (const role of MUSICAL_ROLES) {
      const input = recipe(role);
      const result = generate(input);
      for (const scene of result.lanes[0]!.scenes) {
        const [minimum, maximum] = mutationRanges[role][scene.kind];
        if (role === "bass" || role === "drone") {
          expect(scene.metrics.mutationCount).toBeGreaterThanOrEqual(minimum);
        }
        expect(scene.metrics.mutationCount).toBeLessThanOrEqual(maximum);
        expect(scene.notes.every((note) => input.parameters.scale.intervals.includes(
          (note.pitch - input.parameters.rootPitchClass + 120) % 12,
        ))).toBe(true);
      }
    }
  });

  it("evolves Pad voicings one voice at a time", () => {
    const result = generate(recipe("pad"));
    for (const path of result.plan.paths) {
      for (let index = 1; index < path.events.length; index += 1) {
        const previous = path.events[index - 1]!.pitches;
        const current = path.events[index]!.pitches;
        expect(current.filter((pitch, voice) => pitch !== previous[voice]).length).toBe(1);
      }
    }
  });

  it("derives every scene from recognizable Foundation material", () => {
    const result = generate(recipe("pad"));
    const foundation = result.plan.paths[0]!.events[0]!.pitches;
    for (const path of result.plan.paths.slice(1)) {
      expect(path.events[0]!.pitches.filter((pitch) => foundation.includes(pitch)).length)
        .toBeGreaterThanOrEqual(3);
    }
  });

  it("makes the three musical macros perceptibly distinct", () => {
    const lowMotion = summarizeMacro("motion", 0);
    const highMotion = summarizeMacro("motion", 1);
    expect(highMotion.mutations).toBeGreaterThan(lowMotion.mutations * 1.5);
    expect(highMotion.movement).toBeGreaterThan(lowMotion.movement * 1.8);

    const lowTension = summarizeMacro("tension", 0);
    const highTension = summarizeMacro("tension", 1);
    expect(highTension.tension).toBeGreaterThan(lowTension.tension + 0.08);

    const compact = summarizeMacro("space", 0);
    const open = summarizeMacro("space", 1);
    expect(open.spacing).toBeGreaterThan(compact.spacing * 1.6);
  });

  it("keeps the useful middle of each macro audibly responsive", () => {
    const lowMotion = summarizeMacro("motion", 0.25);
    const highMotion = summarizeMacro("motion", 0.75);
    expect(highMotion.mutations).toBeGreaterThan(lowMotion.mutations * 1.8);
    expect(highMotion.movement).toBeGreaterThan(lowMotion.movement * 3);

    const lowTension = summarizeMacro("tension", 0.25);
    const highTension = summarizeMacro("tension", 0.75);
    expect(highTension.tension).toBeGreaterThan(lowTension.tension + 0.1);

    const compact = summarizeMacro("space", 0.25);
    const open = summarizeMacro("space", 0.75);
    expect(open.spacing).toBeGreaterThan(compact.spacing * 1.8);
  });

  it("sustains common tones instead of retriggering identical pitches", () => {
    for (const role of MUSICAL_ROLES) {
      for (const scene of generate(recipe(role)).lanes[0]!.scenes) {
        const notesByPitch = new Map<number, typeof scene.notes[number][]>();
        for (const note of scene.notes) {
          const notes = notesByPitch.get(note.pitch) ?? [];
          notes.push(note);
          notesByPitch.set(note.pitch, notes);
        }
        for (const notes of notesByPitch.values()) {
          const ordered = [...notes].sort(
            (left, right) => left.startTime - right.startTime,
          );
          for (let index = 1; index < ordered.length; index += 1) {
            const previous = ordered[index - 1]!;
            const current = ordered[index]!;
            expect(previous.startTime + previous.duration).not.toBe(current.startTime);
          }
        }
      }
    }
  });

  it("gives Pad and Arp Source distinct sparse Scene contours", () => {
    for (const role of ["pad", "arp-source"] as const) {
      const scenes = generate(recipe(role)).lanes[0]!.scenes;
      const [foundation, development, tension, release] = scenes.map(
        activeVoiceCounts,
      );

      expect(foundation![0]).toBe(2);
      expect(Math.max(...foundation!)).toBe(role === "pad" ? 3 : 2);
      expect(foundation![31]).toBe(2);

      expect(development![0]).toBe(3);
      expect(Math.min(...development!)).toBe(2);
      expect(development![31]).toBe(3);

      expect(tension![0]).toBeGreaterThanOrEqual(4);
      expect(Math.min(...tension!)).toBeGreaterThanOrEqual(4);
      expect(Math.max(...tension!)).toBeLessThanOrEqual(role === "pad" ? 4 : 5);

      expect(release![0]).toBe(2);
      expect(release![31]).toBe(2);

      const soundingDurations = scenes.map((scene) =>
        scene.notes.reduce((total, note) => total + note.duration, 0),
      );
      expect(soundingDurations[0]).toBeLessThan(soundingDurations[2]!);
      expect(soundingDurations[1]).toBeLessThan(soundingDurations[2]!);
      expect(soundingDurations[3]).toBeLessThan(soundingDurations[2]!);
    }
  });

  it("renders an enabled role matrix from one shared composition plan", () => {
    const input = recipe("bass");
    const result = generate({
      ...input,
      lanes: [
        { id: "bass", role: "bass", octaveOffset: 0, enabled: true },
        { id: "pad-a", role: "pad", octaveOffset: 0, enabled: true },
        { id: "unused", role: "drone", octaveOffset: 0, enabled: false },
        { id: "arp", role: "arp-source", octaveOffset: 0, enabled: true },
      ],
    });

    expect(result.lanes.map((lane) => lane.id)).toEqual(["bass", "pad-a", "arp"]);
    expect(result.metrics.laneCount).toBe(3);
    expect(result.lanes.every((lane) => lane.scenes.length === 4)).toBe(true);
    expect(result.plan.paths).toHaveLength(4);
  });

  it("orchestrates duplicate roles as complementary numbered lanes", () => {
    const input = recipe("pad");
    const result = generate({
      ...input,
      lanes: [
        { id: "pad-a", role: "pad", octaveOffset: 0, enabled: true },
        { id: "pad-b", role: "pad", octaveOffset: 0, enabled: true },
      ],
    });

    expect(result.lanes[0]!.roleInstance).toBe(0);
    expect(result.lanes[1]!.roleInstance).toBe(1);
    expect(result.lanes[1]!.scenes[0]!.name).toBe("Foundation — Pad 2");
    expect(result.lanes[0]!.scenes).not.toEqual(result.lanes[1]!.scenes);
  });

  it("applies a lane octave offset after orchestration", () => {
    const base = recipe("pad");
    const shifted = generate({
      ...base,
      lanes: [{ ...base.lanes[0]!, octaveOffset: 1 }],
    });
    const original = generate(base);
    const originalPitches = original.lanes[0]!.scenes.flatMap((scene) =>
      scene.notes.map((note) => note.pitch)
    );
    const shiftedPitches = shifted.lanes[0]!.scenes.flatMap((scene) =>
      scene.notes.map((note) => note.pitch)
    );
    expect(shiftedPitches).toEqual(originalPitches.map((pitch) => pitch + 12));
  });

});

function summarizeMacro(
  parameter: "motion" | "tension" | "space",
  value: number,
) {
  const summaries = Array.from({ length: 16 }, (_, index) => {
    const input = recipe("pad", index + 1);
    const result = generate({
      ...input,
      parameters: { ...input.parameters, [parameter]: value },
    });
    const scenes = result.lanes[0]!.scenes;
    const sceneCount = scenes.length;
    return {
      mutations: scenes.reduce(
        (total, scene) => total + scene.metrics.mutationCount,
        0,
      ),
      movement: scenes.reduce(
        (total, scene) => total + scene.metrics.averageMovement,
        0,
      ) / sceneCount,
      spacing: scenes.reduce(
        (total, scene) => total + scene.metrics.averageSpacing,
        0,
      ) / sceneCount,
      tension: scenes.reduce(
        (total, scene) => total + scene.metrics.averageTension,
        0,
      ) / sceneCount,
    };
  });

  return {
    mutations: average(summaries.map((summary) => summary.mutations)),
    movement: average(summaries.map((summary) => summary.movement)),
    spacing: average(summaries.map((summary) => summary.spacing)),
    tension: average(summaries.map((summary) => summary.tension)),
  };
}

function average(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function activeVoiceCounts(
  scene: ReturnType<typeof generate>["lanes"][number]["scenes"][number],
): number[] {
  return Array.from({ length: 32 }, (_, beat) =>
    scene.notes.filter(
      (note) => note.startTime <= beat + 0.1 && note.startTime + note.duration > beat + 0.1,
    ).length,
  );
}
