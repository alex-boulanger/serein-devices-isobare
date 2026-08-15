import {
  MUSICAL_ROLES,
  type GenerationRecipe,
} from "../generation/generate";

export interface DestinationState {
  readonly lanes: readonly DestinationLaneState[];
  readonly occupiedCount: number;
  readonly missingSceneCount: number;
}

export interface DestinationLaneState {
  readonly id: string;
  readonly trackName: string;
  readonly occupiedCount: number;
}

export interface GenerationDialogInput {
  readonly recipe: GenerationRecipe;
  readonly destination: DestinationState;
}

export type ModalResult =
  | { readonly kind: "cancel" }
  | {
      readonly kind: "apply";
      readonly recipe: GenerationRecipe;
      readonly overwriteOccupied: boolean;
    };

export function parseModalResult(raw: string): ModalResult {
  let value: unknown;

  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Invalid modal result: expected JSON");
  }

  if (isRecord(value) && value.kind === "cancel") {
    return { kind: "cancel" };
  }

  if (!isApplyResult(value)) {
    throw new Error("Invalid modal result: expected cancel or a versioned generation recipe");
  }

  return value;
}

function isApplyResult(value: unknown): value is Extract<ModalResult, { kind: "apply" }> {
  if (!isRecord(value) || value.kind !== "apply" || !isRecord(value.recipe)) {
    return false;
  }

  const recipe = value.recipe;
  if (
    recipe.engineVersion !== 4 ||
    !isIntegerInRange(recipe.seed, 0, 0xffff_ffff) ||
    !isRecord(recipe.parameters) ||
    !Array.isArray(recipe.lanes) ||
    recipe.lanes.length < 1 ||
    recipe.lanes.length > 8 ||
    typeof value.overwriteOccupied !== "boolean"
  ) {
    return false;
  }

  const { rootPitchClass, scale, motion, tension, space } = recipe.parameters;
  if (
    !isIntegerInRange(rootPitchClass, 0, 11) ||
    !isRecord(scale) ||
    !isNumberInRange(motion, 0, 1) ||
    !isNumberInRange(tension, 0, 1) ||
    !isNumberInRange(space, 0, 1)
  ) {
    return false;
  }

  const laneIds = new Set<string>();
  for (const lane of recipe.lanes) {
    if (
      !isRecord(lane) ||
      typeof lane.id !== "string" ||
      lane.id.length === 0 ||
      laneIds.has(lane.id) ||
      typeof lane.role !== "string" ||
      !MUSICAL_ROLES.includes(lane.role as (typeof MUSICAL_ROLES)[number]) ||
      !isIntegerInRange(lane.octaveOffset, -2, 2) ||
      typeof lane.enabled !== "boolean"
    ) {
      return false;
    }
    laneIds.add(lane.id);
  }
  if (!recipe.lanes.some((lane) => isRecord(lane) && lane.enabled === true)) {
    return false;
  }

  return (
    typeof scale.name === "string" &&
    scale.name.trim().length > 0 &&
    Array.isArray(scale.intervals) &&
    scale.intervals.length > 0 &&
    scale.intervals.length <= 12 &&
    scale.intervals.every((interval) => isIntegerInRange(interval, 0, 11)) &&
    new Set(scale.intervals).size === scale.intervals.length &&
    scale.intervals.includes(0)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
