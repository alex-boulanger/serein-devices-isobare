import {
  initialize,
  type ActivationContext,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

import modalHtml from "../build/ui/index.html";
import {
  getDestinationState,
  writeGeneratedMatrix,
} from "./ableton/session-destination";
import type {
  DestinationState,
  GenerationDialogInput,
} from "./application/modal-result";
import { runGenerationWorkflow } from "./application/run-generation-workflow";
import type { GenerationRecipe } from "./generation/generate";

const API_VERSION = "1.0.0" as const;
const COMMAND_ID = "ambient-harmony.generate";
const DEFAULT_SCALE = {
  name: "Major",
  intervals: [0, 2, 4, 5, 7, 9, 11],
} as const;

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, API_VERSION);

  context.commands.registerCommand(COMMAND_ID, (argument: unknown) => {
    void generateIntoClipSlot(context, argument as Handle).catch((error: unknown) => {
      console.error("Ambient Harmony Generator failed", error);
    });
  });

  void context.ui.registerContextMenuAction(
    "ClipSlot",
    "Generate ambient matrix…",
    COMMAND_ID,
  );
}

async function generateIntoClipSlot(
  context: ExtensionContext<typeof API_VERSION>,
  handle: Handle,
): Promise<void> {
  const destination = getDestinationState(context, handle);
  const defaultRecipe = getDefaultRecipe(context, destination);

  const outcome = await runGenerationWorkflow(defaultRecipe, {
    getDestinationState: (laneIds) => getDestinationState(context, handle, laneIds),
    showModal: (input) =>
      context.ui.showModalDialog(createModalUrl(input), 760, 640),
    createMatrix: (result, overwriteOccupied) =>
      writeGeneratedMatrix(context, handle, result, overwriteOccupied),
  });

  if (outcome === "occupied") {
    console.warn("Ambient Harmony Generator requires overwrite consent for occupied clips.");
  }
}

function getDefaultRecipe(
  context: ExtensionContext<typeof API_VERSION>,
  destination: DestinationState,
): GenerationRecipe {
  const song = context.application.song;
  const scale = song.scaleMode
    ? { name: song.scaleName, intervals: song.scaleIntervals }
    : DEFAULT_SCALE;

  return {
    engineVersion: 4,
    seed: 42,
    parameters: {
      rootPitchClass: song.scaleMode ? song.rootNote : 0,
      scale,
      motion: 0.5,
      tension: 0.4,
      space: 0.65,
    },
    lanes: destination.lanes.map((lane, index) => ({
      id: lane.id,
      role: (["bass", "pad", "drone", "arp-source"] as const)[index % 4]!,
      octaveOffset: 0,
      enabled: true,
    })),
  };
}

function createModalUrl(input: GenerationDialogInput): string {
  const initialState = encodeURIComponent(JSON.stringify(input));
  return `data:text/html,${encodeURIComponent(String(modalHtml))}#${initialState}`;
}
