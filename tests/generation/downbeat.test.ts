import { describe, expect, it } from "bun:test";

import {
  generate,
  type GenerationRecipe,
  type MusicalRole,
  type RoleLaneRecipe,
} from "../../src/generation/generate";

const SEEDS = Array.from({ length: 24 }, (_, index) => index * 101 + 7);

function lane(role: MusicalRole, id = role): RoleLaneRecipe {
  return {
    id,
    role,
    octaveOffset: 0,
    enabled: true,
    ...(role === "bass" ? { style: "articulated" as const } : {}),
    ...(role === "lead" ? { style: "flow" as const } : {}),
  };
}

function matrix(lanes: readonly RoleLaneRecipe[], seed: number): GenerationRecipe {
  return {
    engineVersion: 6,
    seed,
    parameters: {
      rootPitchClass: 0,
      scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
      motion: 0.5,
      tension: 0.5,
      space: 0.6,
    },
    lanes,
  };
}

const ALL = [
  lane("bass"),
  lane("pad"),
  lane("drone"),
  lane("arp-source"),
  lane("lead"),
];

const startsOnDownbeat = (
  lane: ReturnType<typeof generate>["lanes"][number],
  sceneIndex: number,
) => lane.scenes[sceneIndex]!.notes.some((note) => note.startTime === 0);

/**
 * Ownership is permission, not obligation: ADR 0012 lets Bass and Lead delay,
 * bookend or tail-pick their entrance, so the owner may decline beat zero. What
 * allocation guarantees is that nobody *else* takes it.
 *
 * The Arp Source is outside the scheme entirely, per ADR 0017: its onsets are
 * not heard directly, so it sustains the whole Cycle from beat zero.
 */
const PRIORITY = ["drone", "bass", "pad", "arp-source", "lead"] as const;
const EXEMPT = "arp-source";

describe("downbeat allocation", () => {
  it("never lets more than one lane take the downbeat", () => {
    for (const seed of SEEDS) {
      const result = generate(matrix(ALL, seed));
      for (let scene = 0; scene < 4; scene += 1) {
        const owners = result.lanes.filter(
          (item) => item.role !== EXEMPT && startsOnDownbeat(item, scene),
        );
        expect(owners.length).toBeLessThanOrEqual(1);
      }
    }
  });

  it("reserves it for the most structural role present", () => {
    const sets: readonly (readonly RoleLaneRecipe[])[] = [
      ALL,
      [lane("bass"), lane("pad"), lane("lead")],
      [lane("pad"), lane("arp-source"), lane("lead")],
      [lane("arp-source"), lane("lead")],
    ];

    for (const lanes of sets) {
      const expected = PRIORITY.find((role) =>
        lanes.some((candidate) => candidate.role === role),
      );
      for (const seed of SEEDS.slice(0, 8)) {
        const result = generate(matrix(lanes, seed));
        for (let scene = 0; scene < 4; scene += 1) {
          for (const item of result.lanes) {
            if (item.role === expected || item.role === EXEMPT) continue;
            // A lower-priority lane must never open the Scene.
            expect(startsOnDownbeat(item, scene)).toBe(false);
          }
        }
      }
    }
  });

  it("does not push a lone lane off its own downbeat", () => {
    // Roles that establish material immediately; Bass and Lead have their own
    // entrance contracts under ADR 0012 and may enter later by design.
    for (const role of ["drone", "pad", "arp-source"] as const) {
      for (const seed of SEEDS.slice(0, 8)) {
        const result = generate(matrix([lane(role)], seed));
        for (let scene = 0; scene < 4; scene += 1) {
          expect(startsOnDownbeat(result.lanes[0]!, scene)).toBe(true);
        }
      }
    }
  });

  it("still establishes the matrix inside the first bar", () => {
    for (const seed of SEEDS) {
      const result = generate(matrix(ALL, seed));
      for (let scene = 0; scene < 4; scene += 1) {
        const earliest = Math.min(
          ...result.lanes.flatMap((item) =>
            item.scenes[scene]!.notes.map((note) => note.startTime),
          ),
        );
        // Staggering entrances must not delay the whole Scene.
        expect(earliest).toBeLessThanOrEqual(4);
      }
    }
  });

  it("stops the roles piling onto the same instant", () => {
    let stacked = 0;
    let scenes = 0;

    for (const seed of SEEDS) {
      const result = generate(matrix(ALL, seed));
      for (let scene = 0; scene < 4; scene += 1) {
        scenes += 1;
        const roles = new Map<number, Set<string>>();
        for (const item of result.lanes) {
          for (const note of item.scenes[scene]!.notes) {
            const beat = Math.round(note.startTime * 4) / 4;
            roles.set(beat, (roles.get(beat) ?? new Set()).add(item.role));
          }
        }
        for (const together of roles.values()) {
          if (together.size >= 3) stacked += 1;
        }
      }
    }

    // Was ~1.1 per scene, essentially all of it on beat zero; now ~0.29
    // measured over 200 seeds.
    expect(stacked / scenes).toBeLessThan(0.45);
  });
});
