import { getContext, setContext } from "svelte";

import { createRandomSeed } from "../../application/random-seed";
import type { DestinationLaneState } from "../../application/modal-result";
import {
  generate,
  ROLE_STYLES,
  type GenerationRecipe,
  type GenerationResult,
  type MusicalRole,
  type RoleStyle,
  type SceneLabelStyle,
} from "../../generation/generate";
import { closeModal, readDialogInput } from "../live-bridge";

const MAX_SEED = 0xffff_ffff;

export interface LaneDraft {
  id: string;
  role: MusicalRole;
  octaveOffset: number;
  enabled: boolean;
  style: RoleStyle | undefined;
}

export type Session = ReturnType<typeof createSession>;

/**
 * Single source of truth for the modal. Every slice reads this store rather
 * than threading props, because the whole screen edits one versioned recipe.
 */
export function createSession() {
  const input = readDialogInput();
  const lanes = $state<LaneDraft[]>(
    input.recipe.lanes.map((lane) => ({
      id: lane.id,
      role: lane.role,
      octaveOffset: lane.octaveOffset,
      enabled: lane.enabled,
      style: lane.style ?? stylesFor(lane.role)[0],
    })),
  );
  const macros = $state({
    motion: input.recipe.parameters.motion,
    tension: input.recipe.parameters.tension,
    space: input.recipe.parameters.space,
    drift: input.recipe.parameters.drift ?? 0,
  });

  let seed = $state(input.recipe.seed);
  let sceneLabelStyle = $state<SceneLabelStyle>(input.recipe.sceneLabelStyle ?? "name");
  let overwriteOccupied = $state(false);
  let error = $state("");

  const recipe = $derived<GenerationRecipe>({
    engineVersion: 6,
    seed,
    sceneLabelStyle,
    parameters: {
      ...input.recipe.parameters,
      motion: macros.motion,
      tension: macros.tension,
      space: macros.space,
      drift: macros.drift,
    },
    lanes: lanes.map(({ style, ...lane }) => ({
      ...lane,
      ...(style === undefined ? {} : { style }),
    })),
  });

  const enabledCount = $derived(lanes.filter((lane) => lane.enabled).length);

  // The engine rejects invalid lane configurations by throwing; surfacing that
  // as a message keeps a blank modal from being the failure mode.
  const generation = $derived.by((): GenerationOutcome => {
    if (enabledCount === 0) {
      return { result: undefined, failure: "include at least one track" };
    }
    try {
      return { result: generate(recipe), failure: undefined };
    } catch (cause) {
      return {
        result: undefined,
        failure: cause instanceof Error ? cause.message : "generation failed",
      };
    }
  });

  const occupiedCount = $derived(
    lanes.reduce(
      (total, lane) =>
        lane.enabled ? total + (destinationFor(lane.id)?.occupiedCount ?? 0) : total,
      0,
    ),
  );

  function destinationFor(id: string): DestinationLaneState | undefined {
    return input.destination.lanes.find((lane) => lane.id === id);
  }

  return {
    get lanes() {
      return lanes;
    },
    get macros() {
      return macros;
    },
    get seed() {
      return seed;
    },
    set seed(value: number) {
      seed = value;
    },
    get sceneLabelStyle() {
      return sceneLabelStyle;
    },
    set sceneLabelStyle(value: SceneLabelStyle) {
      sceneLabelStyle = value;
    },
    get overwriteOccupied() {
      return overwriteOccupied;
    },
    set overwriteOccupied(value: boolean) {
      overwriteOccupied = value;
    },
    get error() {
      return error;
    },
    get parameters() {
      return input.recipe.parameters;
    },
    get destination() {
      return input.destination;
    },
    get enabledCount() {
      return enabledCount;
    },
    get occupiedCount() {
      return occupiedCount;
    },
    get generation() {
      return generation;
    },
    trackName(id: string): string {
      return destinationFor(id)?.trackName ?? id;
    },
    occupiedFor(id: string): number {
      return destinationFor(id)?.occupiedCount ?? 0;
    },
    setRole(lane: LaneDraft, role: MusicalRole): void {
      lane.role = role;
      lane.style = stylesFor(role)[0];
    },
    randomizeSeed(): void {
      seed = createRandomSeed(seed);
    },
    cancel(): void {
      closeModal({ kind: "cancel" });
    },
    apply(): void {
      error = "";

      if (enabledCount === 0) {
        error = "include at least one track";
        return;
      }
      if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
        error = `seed must be a whole number from 0 to ${MAX_SEED.toLocaleString("en-US")}`;
        return;
      }
      if (generation.failure !== undefined) {
        error = generation.failure;
        return;
      }
      if (occupiedCount > 0 && !overwriteOccupied) {
        error = "enable overwrite, or cancel to preserve the occupied clips";
        return;
      }

      closeModal({ kind: "apply", recipe, overwriteOccupied });
    },
  };
}

interface GenerationOutcome {
  readonly result: GenerationResult | undefined;
  readonly failure: string | undefined;
}

export function stylesFor(role: MusicalRole): readonly RoleStyle[] {
  return ROLE_STYLES[role] ?? [];
}

const SESSION_KEY = Symbol("session");

export function setSession(session: Session): void {
  setContext(SESSION_KEY, session);
}

export function useSession(): Session {
  return getContext<Session>(SESSION_KEY);
}
