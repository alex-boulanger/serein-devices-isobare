import { describe, expect, it, mock } from "bun:test";

import {
  runGenerationWorkflow,
  type GenerationWorkflowPorts,
} from "../../src/application/run-generation-workflow";
import type { GenerationRecipe, GenerationResult } from "../../src/generation/generate";

const defaultRecipe: GenerationRecipe = {
  engineVersion: 4,
  seed: 42,
  parameters: {
    rootPitchClass: 0,
    scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
    motion: 0.5,
    tension: 0.4,
    space: 0.65,
  },
  lanes: [
    { id: "track-0", role: "pad", octaveOffset: 0, enabled: true },
    { id: "track-1", role: "drone", octaveOffset: 0, enabled: false },
  ],
};

function destination(occupiedCount: number, missingSceneCount: number) {
  return {
    occupiedCount,
    missingSceneCount,
    lanes: [
      { id: "track-0", trackName: "Pad", occupiedCount },
      { id: "track-1", trackName: "Drone", occupiedCount: 0 },
    ],
  };
}

describe("runGenerationWorkflow", () => {
  it("shows destination occupancy before cancellation and leaves Live unchanged", async () => {
    const showModal = mock(async () => JSON.stringify({ kind: "cancel" }));
    const createMatrix = mock(async () => undefined);
    const ports: GenerationWorkflowPorts = {
      getDestinationState: () => destination(2, 1),
      showModal,
      createMatrix,
    };

    await expect(runGenerationWorkflow(defaultRecipe, ports)).resolves.toBe("cancelled");
    expect(showModal).toHaveBeenCalledWith({
      recipe: defaultRecipe,
      destination: destination(2, 1),
    });
    expect(createMatrix).not.toHaveBeenCalled();
  });

  it("refuses newly occupied destinations without overwrite consent", async () => {
    let reads = 0;
    const createMatrix = mock(async () => undefined);
    const ports: GenerationWorkflowPorts = {
      getDestinationState: () => destination(reads++ === 0 ? 0 : 1, 0),
      showModal: mock(async () => JSON.stringify({
        kind: "apply",
        recipe: defaultRecipe,
        overwriteOccupied: false,
      })),
      createMatrix,
    };

    await expect(runGenerationWorkflow(defaultRecipe, ports)).resolves.toBe("occupied");
    expect(createMatrix).not.toHaveBeenCalled();
  });

  it("creates four generated scenes with explicit overwrite consent", async () => {
    let created: GenerationResult | undefined;
    let overwrite: boolean | undefined;
    const ports: GenerationWorkflowPorts = {
      getDestinationState: () => destination(2, 0),
      showModal: mock(async () => JSON.stringify({
        kind: "apply",
        recipe: { ...defaultRecipe, seed: 99 },
        overwriteOccupied: true,
      })),
      createMatrix: mock(async (result, allowOverwrite) => {
        created = result;
        overwrite = allowOverwrite;
      }),
    };

    await expect(runGenerationWorkflow(defaultRecipe, ports)).resolves.toBe("created");
    expect(overwrite).toBe(true);
    expect(created?.lanes).toHaveLength(1);
    expect(created?.lanes[0]?.scenes.map((scene) => scene.name)).toEqual([
      "Foundation — Pad",
      "Development — Pad",
      "Tension — Pad",
      "Release — Pad",
    ]);
  });
});
