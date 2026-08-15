import { createCompositionPlan } from "./planning/composition-plan";
import { createOrchestration } from "./planning/orchestration";
import { renderLaneScenes } from "./rendering/render-lane";
import type {
  GeneratedLane,
  GenerationRecipe,
  GenerationResult,
} from "./types";

export * from "./types";

export function generate(recipe: GenerationRecipe): GenerationResult {
  validateLaneConfiguration(recipe);
  const plan = createCompositionPlan(recipe);
  const lanes: GeneratedLane[] = createOrchestration(recipe, plan).map(
    (orchestration) => ({
      id: orchestration.lane.id,
      role: orchestration.lane.role,
      roleInstance: orchestration.roleInstance,
      octaveOffset: orchestration.lane.octaveOffset,
      identity: orchestration.identity,
      harmonicPaths: orchestration.harmonicPaths,
      scenes: renderLaneScenes(recipe, plan, orchestration),
    }),
  );
  const noteCount = lanes.reduce(
    (laneTotal, lane) => laneTotal + lane.scenes.reduce(
      (sceneTotal, scene) => sceneTotal + scene.notes.length,
      0,
    ),
    0,
  );

  return {
    recipe,
    plan,
    lanes,
    metrics: {
      durationBeats: 32,
      noteCount,
      sceneCount: 4,
      laneCount: lanes.length,
    },
    diagnostics: [
      "Four related Harmonic Paths planned before matrix orchestration",
      `Orchestrated ${lanes.length} Role Variants across ${new Set(lanes.map((lane) => lane.role)).size} Role Families`,
      `Rendered ${noteCount} MIDI notes`,
    ],
  };
}

function validateLaneConfiguration(recipe: GenerationRecipe): void {
  if (recipe.lanes.length < 1 || recipe.lanes.length > 8) {
    throw new Error("A generation recipe must contain one to eight role lanes.");
  }
  if (new Set(recipe.lanes.map((lane) => lane.id)).size !== recipe.lanes.length) {
    throw new Error("Role lane ids must be unique.");
  }
  if (!recipe.lanes.some((lane) => lane.enabled)) {
    throw new Error("At least one role lane must be enabled.");
  }
}
