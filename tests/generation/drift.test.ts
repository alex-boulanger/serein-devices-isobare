import { describe, expect, it } from "bun:test";

import { generate, type GenerationRecipe } from "../../src/generation/generate";

const SEEDS = Array.from({ length: 20 }, (_, index) => index * 211 + 5);

const LANES: GenerationRecipe["lanes"] = [
  { id: "bass", role: "bass", octaveOffset: 0, enabled: true, style: "articulated" },
  { id: "pad", role: "pad", octaveOffset: 0, enabled: true },
  { id: "drone", role: "drone", octaveOffset: 0, enabled: true },
  { id: "arp", role: "arp-source", octaveOffset: 0, enabled: true },
  { id: "lead", role: "lead", octaveOffset: 0, enabled: true, style: "flow" },
];

function at(drift: number, seed: number) {
  return generate({
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 0,
      scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
      motion: 0.5,
      tension: 0.5,
      space: 0.6,
      drift,
    },
    lanes: LANES,
  });
}

const everyNote = (drift: number) =>
  SEEDS.flatMap((seed) =>
    at(drift, seed).lanes.flatMap((lane) =>
      lane.scenes.flatMap((scene) =>
        scene.notes.map((note) => ({ note, role: lane.role })),
      ),
    ),
  );

describe("Drift", () => {
  it("widens the register it reaches into", () => {
    const span = (drift: number) => {
      const pitches = everyNote(drift).map((entry) => entry.note.pitch);
      return Math.max(...pitches) - Math.min(...pitches);
    };

    expect(span(1)).toBeGreaterThan(span(0));
  });

  it("thins more of each pass as it rises", () => {
    const sounding = (drift: number) => {
      const notes = everyNote(drift).map((entry) => entry.note);
      return notes.reduce((total, note) => total + (note.probability ?? 1), 0) / notes.length;
    };

    expect(sounding(0)).toBeGreaterThan(sounding(1));
    expect(sounding(1)).toBeGreaterThan(0.7);
  });

  it("never displaces Bass or Drone out of the floor of the mix", () => {
    for (const drift of [0, 0.5, 1]) {
      for (const entry of everyNote(drift)) {
        if (entry.role !== "bass" && entry.role !== "drone") continue;
        // Displacing the structural low end undoes the Orchestration rather
        // than colouring it, so those roles are excluded outright.
        expect(entry.note.pitch).toBeLessThanOrEqual(60);
      }
    }
  });

  it("keeps every displaced note inside the project scale", () => {
    const intervals = [0, 2, 4, 5, 7, 9, 11];
    for (const entry of everyNote(1)) {
      expect(intervals.includes(((entry.note.pitch % 12) + 12) % 12)).toBe(true);
    }
  });

  it("leaves the score untouched at zero, and stays deterministic", () => {
    expect(at(0, 42)).toEqual(at(0, 42));
    expect(at(0.7, 42)).toEqual(at(0.7, 42));
    expect(at(0, 42)).not.toEqual(at(0.7, 42));
  });

  it("renders identically whether Drift is absent or zero", () => {
    const withZero = at(0, 99);
    const { drift: _omitted, ...withoutDrift } = withZero.recipe.parameters;

    const absent = generate({
      ...withZero.recipe,
      parameters: withoutDrift as GenerationRecipe["parameters"],
    });

    expect(absent.lanes.map((lane) => lane.scenes))
      .toEqual(withZero.lanes.map((lane) => lane.scenes));
  });
});
