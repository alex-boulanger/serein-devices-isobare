import { describe, expect, it } from "bun:test";

import { inspectDestinationWindow } from "../../src/application/destination-window";

describe("inspectDestinationWindow", () => {
  it("counts occupancy only in the four slots beginning at the anchor", () => {
    const slots = [
      { clip: { name: "before" } },
      { clip: null },
      { clip: { name: "occupied" } },
      { clip: null },
      { clip: { name: "occupied" } },
      { clip: { name: "after" } },
    ];

    expect(inspectDestinationWindow(slots, 1)).toEqual({
      occupiedCount: 2,
      missingSceneCount: 0,
    });
  });

  it("reports Scene rows that must be appended", () => {
    expect(inspectDestinationWindow([{ clip: null }, { clip: null }], 1)).toEqual({
      occupiedCount: 0,
      missingSceneCount: 3,
    });
  });
});
