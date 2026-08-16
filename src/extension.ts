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
import { createRandomSeed } from "./application/random-seed";
import type {
  GenerationRecipe,
  MusicalRole,
  RoleStyle,
} from "./generation/generate";

const API_VERSION = "1.0.0" as const;
const COMMAND_ID = "ambient-harmony.generate";
const DEFAULT_SCALE = {
  name: "Major",
  intervals: [0, 2, 4, 5, 7, 9, 11],
} as const;

export function activate(activation: ActivationContext): void {
  const context = initialize(activation, API_VERSION);

  context.commands.registerCommand(COMMAND_ID, (argument: unknown) => {
    void generateIntoClipSlot(context, argument as Handle).catch(
      (error: unknown) => {
        console.error("Serein Devices - Isobare failed", error);
      },
    );
  });

  void context.ui.registerContextMenuAction(
    "ClipSlot",
    "Generate…",
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
    getDestinationState: (laneIds) =>
      getDestinationState(context, handle, laneIds),
    showModal: (input) =>
      context.ui.showModalDialog(createModalUrl(input), 760, 640),
    createMatrix: (result, overwriteOccupied) =>
      writeGeneratedMatrix(context, handle, result, overwriteOccupied),
  });

  if (outcome === "occupied") {
    console.warn(
      "Serein Devices - Isobare requires overwrite consent for occupied clips.",
    );
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
    engineVersion: 6,
    seed: createRandomSeed(),
    sceneLabelStyle: "name",
    parameters: {
      rootPitchClass: song.scaleMode ? song.rootNote : 0,
      scale,
      motion: 0.5,
      tension: 0.4,
      space: 0.65,
      drift: 0.35,
    },
    lanes: destination.lanes.map((lane, index) => {
      const role = (["bass", "pad", "drone", "arp-source", "lead"] as const)[
        index % 5
      ]!;
      const roleInstance = Math.floor(index / 5);
      const style = defaultRoleStyle(role, roleInstance);
      return {
        id: lane.id,
        role,
        octaveOffset: 0,
        enabled: true,
        ...(style === undefined ? {} : { style }),
      };
    }),
  };
}

function defaultRoleStyle(
  role: MusicalRole,
  roleInstance: number,
): RoleStyle | undefined {
  if (role === "bass")
    return roleInstance % 2 === 0 ? "articulated" : "sustained";
  if (role === "lead") return roleInstance % 2 === 0 ? "pluck" : "flow";
  return undefined;
}

function createModalUrl(input: GenerationDialogInput): string {
  const initialState = encodeURIComponent(JSON.stringify(input));
  return `data:text/html,${encodeURIComponent(String(modalHtml))}#${initialState}`;
}
