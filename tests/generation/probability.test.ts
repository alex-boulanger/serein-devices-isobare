import { describe, expect, it } from "bun:test";

import { generate, type GenerationRecipe } from "../../src/generation/generate";

const SEEDS = Array.from({ length: 16 }, (_, index) => index * 137 + 11);

function matrix(seed: number, motion = 0.6): GenerationRecipe {
  return {
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 0,
      scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
      motion,
      tension: 0.5,
      space: 0.6,
    },
    lanes: [
      { id: "bass", role: "bass", octaveOffset: 0, enabled: true, style: "articulated" },
      { id: "pad", role: "pad", octaveOffset: 0, enabled: true },
      { id: "drone", role: "drone", octaveOffset: 0, enabled: true },
      { id: "arp", role: "arp-source", octaveOffset: 0, enabled: true },
      { id: "lead", role: "lead", octaveOffset: 0, enabled: true, style: "flow" },
    ],
  };
}

const guaranteed = (note: { readonly probability?: number }) =>
  note.probability === undefined || note.probability === 1;

describe("probabilistic playback (ADR 0009)", () => {
  it("never makes a clip's identity conditional", () => {
    for (const seed of SEEDS) {
      for (const lane of generate(matrix(seed)).lanes) {
        for (const scene of lane.scenes) {
          // Something in every clip must sound on every pass, or launching the
          // Scene could produce silence.
          expect(scene.notes.some(guaranteed)).toBe(true);
        }
      }
    }
  });

  it("keeps every probability a usable fraction", () => {
    for (const seed of SEEDS) {
      for (const lane of generate(matrix(seed)).lanes) {
        for (const scene of lane.scenes) {
          for (const note of scene.notes) {
            if (note.probability === undefined) continue;
            expect(note.probability).toBeGreaterThan(0.5);
            expect(note.probability).toBeLessThan(1);
          }
        }
      }
    }
  });

  it("guarantees the Drone and the Arp Source outright", () => {
    for (const seed of SEEDS) {
      for (const lane of generate(matrix(seed)).lanes) {
        if (lane.role !== "drone" && lane.role !== "arp-source") continue;
        for (const scene of lane.scenes) {
          // A drone is structural, and a thinned Arp Source would stall Live's
          // Arpeggiator mid-pattern.
          expect(scene.notes.every(guaranteed)).toBe(true);
        }
      }
    }
  });

  it("guarantees phrase boundaries and the opening Bass attack", () => {
    for (const seed of SEEDS) {
      for (const lane of generate(matrix(seed)).lanes) {
        if (lane.role !== "lead" && lane.role !== "bass") continue;
        for (const scene of lane.scenes) {
          const ordered = [...scene.notes].sort(
            (left, right) => left.startTime - right.startTime,
          );
          expect(guaranteed(ordered[0]!)).toBe(true);
          if (lane.role === "lead") {
            expect(guaranteed(ordered.at(-1)!)).toBe(true);
          }
        }
      }
    }
  });

  it("evolves the performance without eroding it", () => {
    let optional = 0;
    let expectedSounding = 0;
    let total = 0;

    // The busiest setting, where there is the most ornament to thin.
    for (const seed of SEEDS) {
      for (const lane of generate(matrix(seed, 1)).lanes) {
        for (const scene of lane.scenes) {
          for (const note of scene.notes) {
            total += 1;
            if (!guaranteed(note)) optional += 1;
            expectedSounding += note.probability ?? 1;
          }
        }
      }
    }

    // Ornament exists at all…
    expect(optional).toBeGreaterThan(0);
    // …but a typical pass still sounds the overwhelming majority of the score.
    expect(expectedSounding / total).toBeGreaterThan(0.85);
  });

  it("stays deterministic, so the same recipe scores identically", () => {
    expect(generate(matrix(4242))).toEqual(generate(matrix(4242)));
  });
});
