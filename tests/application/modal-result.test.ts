import { describe, expect, it } from "bun:test";

import {
  parseModalResult,
  type ModalResult,
} from "../../src/application/modal-result";

const validApply = {
  kind: "apply",
  overwriteOccupied: false,
  recipe: {
    engineVersion: 3,
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
});
