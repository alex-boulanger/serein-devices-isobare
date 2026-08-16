import { describe, expect, it } from "bun:test";

import {
  parseModalResult,
  type ModalResult,
} from "../../src/application/modal-result";

const validApply = {
  kind: "apply",
  overwriteOccupied: false,
  recipe: {
    engineVersion: 6,
    seed: 42,
    parameters: {
      rootPitchClass: 2,
      scale: { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10] },
      motion: 0.5,
      tension: 0.45,
      space: 0.65,
    },
    lanes: [
      { id: "track-0", role: "pad", octaveOffset: 0, enabled: true },
      { id: "track-1", role: "arp-source", octaveOffset: 1, enabled: false },
    ],
  },
} satisfies ModalResult;

describe("parseModalResult", () => {
  it("accepts a valid versioned recipe and overwrite decision", () => {
    const raw = JSON.stringify(validApply);
    expect(parseModalResult(raw)).toEqual(validApply);
  });

  it("rejects invalid controls and unknown lane roles", () => {
    expect(() => parseModalResult(JSON.stringify({
      ...validApply,
      recipe: {
        ...validApply.recipe,
        parameters: { ...validApply.recipe.parameters, motion: 1.2 },
      },
    }))).toThrow("Invalid modal result");

    expect(() => parseModalResult(JSON.stringify({
      ...validApply,
      recipe: {
        ...validApply.recipe,
        lanes: [{ ...validApply.recipe.lanes[0], role: "lead" }],
      },
    }))).toThrow("Invalid modal result");
  });

  it("requires unique lane ids and at least one enabled lane", () => {
    expect(() => parseModalResult(JSON.stringify({
      ...validApply,
      recipe: {
        ...validApply.recipe,
        lanes: validApply.recipe.lanes.map((lane) => ({ ...lane, enabled: false })),
      },
    }))).toThrow("Invalid modal result");

    expect(() => parseModalResult(JSON.stringify({
      ...validApply,
      recipe: {
        ...validApply.recipe,
        lanes: [validApply.recipe.lanes[0], validApply.recipe.lanes[0]],
      },
    }))).toThrow("Invalid modal result");
  });

  it("requires an explicit overwrite decision", () => {
    const { overwriteOccupied: _removed, ...withoutOverwrite } = validApply;
    expect(() => parseModalResult(JSON.stringify(withoutOverwrite)))
      .toThrow("Invalid modal result");
  });

  it("requires a supported Role Style exactly where the role defines one", () => {
    const leadLane = {
      ...validApply.recipe.lanes[0]!,
      role: "lead" as const,
      style: "flow" as const,
    };
    const leadApply: ModalResult = {
      ...validApply,
      recipe: { ...validApply.recipe, lanes: [leadLane] },
    };
    expect(parseModalResult(JSON.stringify({
      ...validApply,
      recipe: { ...validApply.recipe, lanes: [leadLane] },
    }))).toEqual(leadApply);

    for (const style of [undefined, "legato"]) {
      expect(() => parseModalResult(JSON.stringify({
        ...validApply,
        recipe: {
          ...validApply.recipe,
          lanes: [{ ...validApply.recipe.lanes[0], role: "lead", style }],
        },
      }))).toThrow("Invalid modal result");
    }

    const bassLane = {
      ...validApply.recipe.lanes[0]!,
      role: "bass" as const,
      style: "sustained" as const,
    };
    expect(parseModalResult(JSON.stringify({
      ...validApply,
      recipe: { ...validApply.recipe, lanes: [bassLane] },
    }))).toEqual({
      ...validApply,
      recipe: { ...validApply.recipe, lanes: [bassLane] },
    });

    expect(() => parseModalResult(JSON.stringify({
      ...validApply,
      recipe: {
        ...validApply.recipe,
        lanes: [{ ...validApply.recipe.lanes[0], role: "pad", style: "pluck" }],
      },
    }))).toThrow("Invalid modal result");
  });
});
