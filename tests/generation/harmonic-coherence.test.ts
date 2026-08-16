import { describe, expect, it } from "bun:test";

import {
  generate,
  type GeneratedLane,
  type GenerationRecipe,
  type HarmonicPath,
} from "../../src/generation/generate";

function recipe(
  overrides: Partial<GenerationRecipe["parameters"]> = {},
  seed = 73,
): GenerationRecipe {
  return {
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.5,
      tension: 0.45,
      space: 0.65,
      ...overrides,
    },
    lanes: [
      { id: "bass", role: "bass", style: "sustained", octaveOffset: 0, enabled: true },
      { id: "pad", role: "pad", octaveOffset: 0, enabled: true },
      { id: "lead", role: "lead", style: "flow", octaveOffset: 0, enabled: true },
    ],
  };
}

function laneOf(result: ReturnType<typeof generate>, id: string): GeneratedLane {
  return result.lanes.find((lane) => lane.id === id)!;
}

/** Pitch classes of the harmonic state sounding at a given beat. */
function soundingClasses(path: HarmonicPath, beat: number): Set<number> {
  const event = path.events.reduce(
    (latest, candidate) => (candidate.beat <= beat ? candidate : latest),
    path.events[0]!,
  );
  return new Set(event.pitches.map((pitch) => ((pitch % 12) + 12) % 12));
}

const seeds = [3, 17, 73, 128, 501, 900, 1774, 4242];

describe("Bass follows the Harmonic Path", () => {
  it("only sounds pitch classes present in the harmony under it", () => {
    for (const seed of seeds) {
      const result = generate(recipe({}, seed));
      const bass = laneOf(result, "bass");

      bass.scenes.forEach((scene, index) => {
        const path = bass.harmonicPaths[index]!;
        for (const note of scene.notes) {
          expect(
            soundingClasses(path, note.startTime).has(((note.pitch % 12) + 12) % 12),
          ).toBe(true);
        }
      });
    }
  });

  it("changes with Tension, because the harmony it tracks changes", () => {
    const signature = (tension: number) =>
      laneOf(generate(recipe({ tension })), "bass").scenes
        .map((scene) => scene.notes.map((note) => note.pitch % 12).join(","))
        .join("|");

    expect(signature(1)).not.toBe(signature(0));
  });

  it("still prefers anchor tones when the harmony offers one", () => {
    const result = generate(recipe());
    const bass = laneOf(result, "bass");
    const anchors = new Set(result.plan.pitchHierarchy.anchors);
    let anchored = 0;
    let total = 0;

    bass.scenes.forEach((scene, index) => {
      const path = bass.harmonicPaths[index]!;
      for (const note of scene.notes) {
        const available = [...soundingClasses(path, note.startTime)].some((pitchClass) =>
          anchors.has(pitchClass),
        );
        if (!available) continue;
        total += 1;
        if (anchors.has(((note.pitch % 12) + 12) % 12)) anchored += 1;
      }
    });

    expect(total).toBeGreaterThan(0);
    expect(anchored / total).toBeGreaterThanOrEqual(0.6);
  });
});

describe("Lead agrees with the harmony under it", () => {
  it("anchors phrase boundaries to a sounding harmony tone", () => {
    let anchored = 0;
    let total = 0;

    for (const seed of seeds) {
      const result = generate(recipe({}, seed));
      const lead = laneOf(result, "lead");

      lead.scenes.forEach((scene, index) => {
        const path = lead.harmonicPaths[index]!;
        const ordered = [...scene.notes].sort(
          (left, right) => left.startTime - right.startTime,
        );
        for (const note of [ordered[0]!, ordered.at(-1)!]) {
          total += 1;
          if (soundingClasses(path, note.startTime).has(((note.pitch % 12) + 12) % 12)) {
            anchored += 1;
          }
        }
      });
    }

    expect(total).toBeGreaterThan(0);
    expect(anchored / total).toBeGreaterThanOrEqual(0.9);
  });

  it("keeps semitone clashes against the sounding harmony rare", () => {
    let clashes = 0;
    let total = 0;

    for (const seed of seeds) {
      const result = generate(recipe({}, seed));
      const lead = laneOf(result, "lead");

      lead.scenes.forEach((scene, index) => {
        const path = lead.harmonicPaths[index]!;
        for (const note of scene.notes) {
          const pitchClass = ((note.pitch % 12) + 12) % 12;
          total += 1;
          for (const sounding of soundingClasses(path, note.startTime)) {
            const interval = Math.abs(pitchClass - sounding) % 12;
            if (interval === 1 || interval === 11) {
              clashes += 1;
              break;
            }
          }
        }
      });
    }

    expect(total).toBeGreaterThan(0);
    expect(clashes / total).toBeLessThanOrEqual(0.04);
  });

  it("still permits abrasive material at high Tension", () => {
    const clashRate = (tension: number) => {
      let clashes = 0;
      let total = 0;
      for (const seed of seeds) {
        const lead = laneOf(generate(recipe({ tension }, seed)), "lead");
        lead.scenes.forEach((scene, index) => {
          const path = lead.harmonicPaths[index]!;
          for (const note of scene.notes) {
            const pitchClass = ((note.pitch % 12) + 12) % 12;
            total += 1;
            for (const sounding of soundingClasses(path, note.startTime)) {
              const interval = Math.abs(pitchClass - sounding) % 12;
              if (interval === 1 || interval === 11) {
                clashes += 1;
                break;
              }
            }
          }
        });
      }
      return clashes / total;
    };

    expect(clashRate(1)).toBeGreaterThan(clashRate(0.2));
  });

  it("keeps every aligned note inside the project scale", () => {
    for (const seed of seeds) {
      const input = recipe({}, seed);
      const lead = laneOf(generate(input), "lead");
      for (const scene of lead.scenes) {
        for (const note of scene.notes) {
          expect(
            input.parameters.scale.intervals.includes(
              (note.pitch - input.parameters.rootPitchClass + 120) % 12,
            ),
          ).toBe(true);
        }
      }
    }
  });
});
