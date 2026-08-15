import {
  MidiTrack,
  type ClipSlot,
  type ExtensionContext,
  type Handle,
} from "@ableton-extensions/sdk";

import type { DestinationState } from "../application/modal-result";
import { inspectDestinationWindow } from "../application/destination-window";
import {
  SCENE_KINDS,
  SCENE_NAMES,
  type GeneratedScene,
  type GenerationResult,
} from "../generation/generate";

const API_VERSION = "1.0.0" as const;
const SCENE_COUNT = 4;
const MAX_LANES = 8;

interface DestinationLane {
  readonly id: string;
  readonly track: MidiTrack<typeof API_VERSION>;
}

interface MatrixLocation {
  readonly lanes: readonly DestinationLane[];
  readonly sceneIndex: number;
}

export function getDestinationState(
  context: ExtensionContext<typeof API_VERSION>,
  anchor: Handle,
  laneIds?: readonly string[],
): DestinationState {
  const location = locateMatrix(context, anchor);
  const selectedIds = laneIds === undefined ? undefined : new Set(laneIds);
  const lanes = location.lanes.map(({ id, track }) => ({
    id,
    trackName: track.name,
    occupiedCount: inspectDestinationWindow(
      track.clipSlots,
      location.sceneIndex,
      SCENE_COUNT,
    ).occupiedCount,
  }));
  assertKnownLaneIds(location.lanes, selectedIds);
  const included = selectedIds === undefined
    ? lanes
    : lanes.filter((lane) => selectedIds.has(lane.id));

  return {
    lanes,
    occupiedCount: included.reduce((total, lane) => total + lane.occupiedCount, 0),
    missingSceneCount: inspectDestinationWindow(
      location.lanes[0]!.track.clipSlots,
      location.sceneIndex,
      SCENE_COUNT,
    ).missingSceneCount,
  };
}

export async function writeGeneratedMatrix(
  context: ExtensionContext<typeof API_VERSION>,
  anchor: Handle,
  result: GenerationResult,
  overwriteOccupied: boolean,
): Promise<void> {
  await context.withinTransaction(() => {
    const initial = locateMatrix(context, anchor);
    const laneMap = new Map(initial.lanes.map((lane) => [lane.id, lane]));
    assertGeneratedLanesExist(result, laneMap);
    const missingSceneCount = Math.max(
      0,
      initial.sceneIndex + SCENE_COUNT - initial.lanes[0]!.track.clipSlots.length,
    );
    const availableSceneCount = SCENE_COUNT - missingSceneCount;

    return appendMissingScenes(context, missingSceneCount, availableSceneCount).then(() => {
      const current = locateMatrix(context, anchor);
      const currentLaneMap = new Map(current.lanes.map((lane) => [lane.id, lane]));
      assertGeneratedLanesExist(result, currentLaneMap);
      const writes = result.lanes.flatMap((generatedLane) => {
        const destination = currentLaneMap.get(generatedLane.id)!;
        const slots = destination.track.clipSlots.slice(
          current.sceneIndex,
          current.sceneIndex + SCENE_COUNT,
        );
        if (slots.length !== SCENE_COUNT) {
          throw new Error("Unable to resolve the four destination Scene rows.");
        }
        return generatedLane.scenes.map((scene, index) => ({
          slot: slots[index]!,
          scene,
        }));
      });

      if (!overwriteOccupied && writes.some(({ slot }) => slot.clip !== null)) {
        throw new Error("A destination clip became occupied before generation.");
      }

      return Promise.all(
        writes.map(({ slot, scene }) => replaceClip(slot, scene, overwriteOccupied)),
      );
    });
  });
}

function locateMatrix(
  context: ExtensionContext<typeof API_VERSION>,
  anchor: Handle,
): MatrixLocation {
  const tracks = context.application.song.tracks;
  const anchorTrackIndex = tracks.findIndex((track) =>
    track.clipSlots.some((slot) => slot.handle.id === anchor.id),
  );
  if (anchorTrackIndex < 0) {
    throw new Error("The selected clip slot is no longer available.");
  }
  const sceneIndex = tracks[anchorTrackIndex]!.clipSlots.findIndex(
    (slot) => slot.handle.id === anchor.id,
  );
  const lanes: DestinationLane[] = [];

  for (
    let offset = 0;
    offset < MAX_LANES && anchorTrackIndex + offset < tracks.length;
    offset += 1
  ) {
    const candidate = tracks[anchorTrackIndex + offset]!;
    try {
      lanes.push({
        id: `track-${offset}`,
        track: context.getObjectFromHandle(candidate.handle, MidiTrack),
      });
    } catch {
      if (offset === 0) {
        throw new Error("Select a clip slot on a MIDI track.");
      }
      break;
    }
  }

  if (lanes.length === 0) {
    throw new Error("No MIDI tracks are available from the selected clip slot.");
  }
  return { lanes, sceneIndex };
}

function assertKnownLaneIds(
  lanes: readonly DestinationLane[],
  selectedIds: ReadonlySet<string> | undefined,
): void {
  if (selectedIds === undefined) return;
  const available = new Set(lanes.map((lane) => lane.id));
  if ([...selectedIds].some((id) => !available.has(id))) {
    throw new Error("A selected destination track is no longer available.");
  }
}

function assertGeneratedLanesExist(
  result: GenerationResult,
  lanes: ReadonlyMap<string, DestinationLane>,
): void {
  if (result.lanes.some((lane) => !lanes.has(lane.id))) {
    throw new Error("A selected destination track is no longer available.");
  }
}

function appendMissingScenes(
  context: ExtensionContext<typeof API_VERSION>,
  count: number,
  firstSceneOffset: number,
): Promise<void> {
  let chain = Promise.resolve();
  for (let index = 0; index < count; index += 1) {
    chain = chain.then(() =>
      context.application.song.createScene(-1).then((scene) => {
        const kind = SCENE_KINDS[firstSceneOffset + index];
        if (kind !== undefined) scene.name = SCENE_NAMES[kind];
      }),
    );
  }
  return chain;
}

function replaceClip(
  slot: ClipSlot<typeof API_VERSION>,
  scene: GeneratedScene,
  overwriteOccupied: boolean,
): Promise<void> {
  const removeExisting = slot.clip === null
    ? Promise.resolve()
    : overwriteOccupied
      ? slot.deleteClip()
      : Promise.reject(new Error("Refusing to overwrite an occupied clip."));

  return removeExisting.then(() =>
    slot.createMidiClip(scene.durationBeats).then((clip) => {
      clip.name = scene.name;
      clip.looping = true;
      clip.notes = scene.notes.map((note) => ({ ...note }));
    }),
  );
}
