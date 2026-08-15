import {
  generate,
  type GenerationRecipe,
  type GenerationResult,
} from "../generation/generate";
import { parseModalResult } from "./modal-result";
import type { DestinationState, GenerationDialogInput } from "./modal-result";

export interface GenerationWorkflowPorts {
  readonly getDestinationState: (laneIds?: readonly string[]) => DestinationState;
  readonly showModal: (input: GenerationDialogInput) => Promise<string>;
  readonly createMatrix: (
    result: GenerationResult,
    overwriteOccupied: boolean,
  ) => Promise<void>;
}

export type GenerationWorkflowOutcome = "cancelled" | "created" | "occupied";

export async function runGenerationWorkflow(
  defaultRecipe: GenerationRecipe,
  ports: GenerationWorkflowPorts,
): Promise<GenerationWorkflowOutcome> {
  const initialDestination = ports.getDestinationState();
  const modalResult = parseModalResult(await ports.showModal({
    recipe: defaultRecipe,
    destination: initialDestination,
  }));
  if (modalResult.kind === "cancel") {
    return "cancelled";
  }

  const enabledLaneIds = modalResult.recipe.lanes
    .filter((lane) => lane.enabled)
    .map((lane) => lane.id);
  if (
    ports.getDestinationState(enabledLaneIds).occupiedCount > 0 &&
    !modalResult.overwriteOccupied
  ) {
    return "occupied";
  }

  await ports.createMatrix(
    generate(modalResult.recipe),
    modalResult.overwriteOccupied,
  );
  return "created";
}
