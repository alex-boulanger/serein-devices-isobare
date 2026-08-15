import { createCompositionPlan } from "./composition-plan";
import { renderRoleScenes } from "./render-role";
import type {
  GeneratedLane,
  GenerationRecipe,
  GenerationResult,
  MusicalRole,
} from "./types";

export * from "./types";

export function generate(recipe: GenerationRecipe): GenerationResult {
  validateLaneConfiguration(recipe);
  const plan = createCompositionPlan(recipe);
  const roleCounts = new Map<MusicalRole, number>();
  const lanes: GeneratedLane[] = recipe.lanes
    .filter((lane) => lane.enabled)
    .map((lane) => {
      const roleInstance = roleCounts.get(lane.role) ?? 0;
      roleCounts.set(lane.role, roleInstance + 1);
      return {
        id: lane.id,
        role: lane.role,
        roleInstance,
        octaveOffset: lane.octaveOffset,
        scenes: renderRoleScenes(recipe, plan, lane, roleInstance),
      };
    });
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
      "Four related Harmonic Paths planned before role rendering",
      `Orchestrated ${lanes.length} role lanes with ${noteCount} MIDI notes`,
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
