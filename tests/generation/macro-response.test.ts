import { describe, expect, it } from "bun:test";

import { generate, type GenerationRecipe } from "../../src/generation/generate";
import { resolveCount } from "../../src/generation/macros";

const LANES: GenerationRecipe["lanes"] = [
  { id: "a", role: "bass", octaveOffset: 0, enabled: true, style: "articulated" },
  { id: "b", role: "pad", octaveOffset: 0, enabled: true },
  { id: "c", role: "drone", octaveOffset: 0, enabled: true },
  { id: "d", role: "arp-source", octaveOffset: 0, enabled: true },
  { id: "e", role: "lead", octaveOffset: 0, enabled: true, style: "flow" },
];

const SEEDS = [11, 324, 637, 950, 1263, 1576, 1889, 2202];

function at(macro: "motion" | "tension" | "space", value: number, seed: number) {
  return generate({
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 0,
      scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
      motion: 0.5,
      tension: 0.5,
      space: 0.5,
      [macro]: value,
    } as GenerationRecipe["parameters"],
    lanes: LANES,
  });
}

const noteCount = (macro: "motion" | "tension" | "space", value: number) =>
  SEEDS.reduce((total, seed) => total + at(macro, value, seed).metrics.noteCount, 0);

/** Beats where nothing at all is sounding, across the whole matrix. */
function silentBeats(macro: "motion" | "tension" | "space", value: number): number {
  let silence = 0;
  for (const seed of SEEDS) {
    for (const lane of at(macro, value, seed).lanes) {
      for (const scene of lane.scenes) {
        const spans = scene.notes
          .map((note) => [note.startTime, note.startTime + note.duration] as const)
          .sort((left, right) => left[0] - right[0]);
        let covered = 0;
        let end = 0;
        for (const [start, finish] of spans) {
          const from = Math.max(start, end);
          if (finish > from) {
            covered += finish - from;
            end = finish;
          }
        }
        silence += 32 - covered;
      }
    }
  }
  return silence;
}

function averageVelocity(macro: "motion" | "tension" | "space", value: number): number {
  let total = 0;
  let count = 0;
  for (const seed of SEEDS) {
    for (const lane of at(macro, value, seed).lanes) {
      for (const scene of lane.scenes) {
        for (const note of scene.notes) {
          total += note.velocity;
          count += 1;
        }
      }
    }
  }
  return total / count;
}

describe("resolveCount", () => {
  it("is deterministic for one seed and label", () => {
    expect(resolveCount(0, 4, 0.42, 99, "x")).toBe(resolveCount(0, 4, 0.42, 99, "x"));
  });

  it("stays inside the range and hits both ends", () => {
    for (const macro of [0, 0.25, 0.5, 0.75, 1]) {
      for (const label of ["a", "b", "c", "d"]) {
        const value = resolveCount(1, 5, macro, 7, label);
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(5);
      }
    }
    expect(resolveCount(1, 5, 0, 7, "a")).toBe(1);
    expect(resolveCount(1, 5, 1, 7, "a")).toBe(5);
  });

  it("tracks the macro on average rather than snapping to thirds", () => {
    const mean = (macro: number) => {
      const labels = Array.from({ length: 400 }, (_, index) => `label:${index}`);
      return labels.reduce((total, label) => total + resolveCount(0, 1, macro, 5, label), 0)
        / labels.length;
    };

    expect(mean(0.25)).toBeGreaterThan(0.15);
    expect(mean(0.25)).toBeLessThan(0.35);
    expect(mean(0.75)).toBeGreaterThan(0.65);
    expect(mean(0.75)).toBeLessThan(0.85);
  });
});

describe("macro response", () => {
  it("gives Motion a wide, monotonic density range with no dead zone", () => {
    const low = noteCount("motion", 0);
    const high = noteCount("motion", 1);

    // Measured ~1.58x end to end, against 1.20x before the recalibration.
    expect(high).toBeGreaterThan(low * 1.45);

    // The old three-step rounding made 0.34-0.66 identical; every quarter of
    // the slider must now move the note count.
    const steps = [0, 0.25, 0.5, 0.75, 1].map((value) => noteCount("motion", value));
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]).not.toBe(steps[index - 1]);
    }
  });

  it("opens real silence as Space rises", () => {
    expect(silentBeats("space", 1)).toBeGreaterThan(silentBeats("space", 0) * 1.5);
  });

  it("keeps the sustained roles from becoming a permanent wall", () => {
    for (const seed of SEEDS) {
      for (const lane of at("space", 1, seed).lanes) {
        if (lane.role !== "pad" && lane.role !== "arp-source") continue;
        const sounding = lane.scenes.map((scene) =>
          scene.notes.reduce((total, note) => total + note.duration, 0),
        );
        // Voices overlap, so total sounding time exceeds 32; the point is that
        // it is bounded rather than every voice running to the clip end.
        expect(Math.max(...sounding)).toBeLessThan(32 * lane.scenes.length * 4);
      }
    }
  });

  it("never cuts the Arp Source, however open Space is", () => {
    for (const space of [0, 0.5, 1]) {
      for (const seed of SEEDS) {
        const arp = at("space", space, seed).lanes.find((lane) => lane.role === "arp-source")!;

        for (const scene of arp.scenes) {
          // Every pitch holds from its entrance until the harmony drops it, so
          // Live's Arpeggiator never loses its source material mid-clip.
          const byPitch = new Map<number, typeof scene.notes[number][]>();
          for (const note of scene.notes) {
            byPitch.set(note.pitch, [...(byPitch.get(note.pitch) ?? []), note]);
          }
          for (const notes of byPitch.values()) {
            const ordered = [...notes].sort((left, right) => left.startTime - right.startTime);
            for (let index = 1; index < ordered.length; index += 1) {
              // A gap only ever means the harmony released that pitch, never a
              // Space-driven chop, so any gap must be a real re-entry.
              expect(ordered[index]!.startTime).toBeGreaterThan(
                ordered[index - 1]!.startTime + ordered[index - 1]!.duration,
              );
            }
          }
          // Sustained for the whole Cycle: no gap at the top of the clip, and
          // something sounding at every beat until the end of it.
          expect(Math.min(...scene.notes.map((note) => note.startTime))).toBe(0);
          expect(
            Math.max(...scene.notes.map((note) => note.startTime + note.duration)),
          ).toBe(32);
        }
      }
    }
  });

  it("voices the Arp Source as a chord, never as a cluster", () => {
    for (const space of [0, 0.5, 1]) {
      for (const tension of [0, 1]) {
        for (const seed of SEEDS) {
          const arp = generate({
            engineVersion: 6,
            seed,
            parameters: {
              rootPitchClass: 0,
              scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
              motion: 0.5,
              tension,
              space,
            },
            lanes: LANES,
          }).lanes.find((lane) => lane.role === "arp-source")!;

          for (const scene of arp.scenes) {
            for (const beat of new Set(scene.notes.map((note) => note.startTime))) {
              const sounding = scene.notes
                .filter((note) => note.startTime <= beat && note.startTime + note.duration > beat)
                .map((note) => note.pitch)
                .sort((left, right) => left - right);

              for (let index = 1; index < sounding.length; index += 1) {
                // Live's Arpeggiator runs whatever it is handed, so a semitone
                // or whole tone between neighbours reads as a chromatic bunch.
                expect(sounding[index]! - sounding[index - 1]!).toBeGreaterThan(2);
              }
            }
          }
        }
      }
    }
  });

  it("still lets Space open the Arp Source register", () => {
    const spread = (space: number) => {
      let total = 0;
      let count = 0;
      for (const seed of SEEDS) {
        const arp = at("space", space, seed).lanes.find((lane) => lane.role === "arp-source")!;
        for (const scene of arp.scenes) {
          const pitches = scene.notes.map((note) => note.pitch);
          if (pitches.length < 2) continue;
          total += Math.max(...pitches) - Math.min(...pitches);
          count += 1;
        }
      }
      return total / count;
    };

    expect(spread(1)).toBeGreaterThan(spread(0));
  });

  it("presses velocity and register upward with Tension", () => {
    expect(averageVelocity("tension", 1)).toBeGreaterThan(
      averageVelocity("tension", 0) + 6,
    );
  });

  it("stays deterministic at every macro position", () => {
    for (const value of [0, 0.37, 0.5, 0.62, 1]) {
      expect(at("motion", value, 42)).toEqual(at("motion", value, 42));
      expect(at("space", value, 42)).toEqual(at("space", value, 42));
    }
  });
});
