import { createAllowedPitches } from "./composition-plan";
import { interpolate, macroUnit } from "../macros";
import { deriveSeed } from "../random";
import type {
  BassArticulationFamily,
  CompositionPlan,
  GenerationRecipe,
  HarmonicPath,
  MusicalRole,
  OrchestralIdentity,
  RoleLaneRecipe,
  SceneKind,
} from "../types";
import { BASS_ARTICULATION_FAMILIES } from "../types";

export interface SceneProfile {
  readonly scene: SceneKind;
  readonly activity: number;
  readonly densityScale: number;
}

export interface OrchestratedLane {
  readonly lane: RoleLaneRecipe;
  readonly roleInstance: number;
  readonly identity: OrchestralIdentity;
  readonly harmonicPaths: readonly HarmonicPath[];
  readonly profiles: Readonly<Record<SceneKind, SceneProfile>>;
  /** Beats after the downbeat before this lane may first sound. */
  readonly downbeatOffset: number;
}

/**
 * Lower is more structural. The most structural enabled lane establishes the
 * Scene on beat zero and the rest enter behind it, so launching a Scene is one
 * foundation attack followed by the texture assembling, rather than every role
 * firing at once. CONTEXT.md asks the *combined* structural roles to establish
 * material at launch, not each role individually, and ADR 0012 already permits
 * role-specific entrance shapes.
 */
const DOWNBEAT_PRIORITY: Readonly<Record<MusicalRole, number>> = {
  drone: 0,
  bass: 1,
  pad: 2,
  "arp-source": 3,
  lead: 4,
};

/** Longest a non-owner may wait, in beats, at the most open Space setting. */
const MAX_ENTRANCE_DELAY = 3;

const ROLE_ACTIVITY: Readonly<
  Record<MusicalRole, Readonly<Record<SceneKind, number>>>
> = {
  bass: { foundation: 0.7, development: 1, tension: 1, release: 0.55 },
  pad: { foundation: 0.85, development: 1, tension: 0.9, release: 0.65 },
  drone: { foundation: 1, development: 0.75, tension: 0.6, release: 0.85 },
  "arp-source": { foundation: 0.65, development: 0.85, tension: 1, release: 0.55 },
  lead: { foundation: 0.7, development: 0.9, tension: 1, release: 0.55 },
};

const IDENTITY_NAMES = [
  "Anchor", "Lift", "Depth", "Drift", "Horizon", "Color", "Open", "Pulse",
] as const;
const REGISTER_OFFSETS = [0, 12, -12, 0, 12, -12, 0, 12] as const;
const STABILITY = [0.9, 0.55, 0.75, 0.4, 0.65, 0.35, 0.8, 0.5] as const;

export function createOrchestration(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
): OrchestratedLane[] {
  const enabled = recipe.lanes.filter((lane) => lane.enabled);
  const familyCount = new Set(enabled.map((lane) => lane.role)).size;
  const familyDensityScale = Math.max(0.7, 1 - (familyCount - 1) * 0.1);
  const roleCounts = new Map<MusicalRole, number>();
  // Ownership is relative to what is enabled, so a Pad-only matrix still opens
  // on its Pad rather than waiting for a Drone that is not there.
  const downbeatOwner = [...enabled].sort(
    (left, right) => DOWNBEAT_PRIORITY[left.role] - DOWNBEAT_PRIORITY[right.role],
  )[0];

  return enabled.map((lane) => {
    const roleInstance = roleCounts.get(lane.role) ?? 0;
    roleCounts.set(lane.role, roleInstance + 1);
    const identity = createIdentity(recipe, lane, roleInstance);
    const profileFor = (scene: SceneKind): SceneProfile => {
      const activity = ROLE_ACTIVITY[lane.role][scene];
      return { scene, activity, densityScale: familyDensityScale * activity };
    };
    const profiles: Readonly<Record<SceneKind, SceneProfile>> = {
      foundation: profileFor("foundation"),
      development: profileFor("development"),
      tension: profileFor("tension"),
      release: profileFor("release"),
    };

    return {
      lane,
      roleInstance,
      identity,
      harmonicPaths: createSiblingPaths(recipe, plan.paths, identity),
      profiles,
      downbeatOffset: lane.id === downbeatOwner?.id ? 0 : entranceDelay(recipe, lane),
    };
  });
}

/** A quantised, deterministic wait that widens as Space opens the texture. */
function entranceDelay(recipe: GenerationRecipe, lane: RoleLaneRecipe): number {
  const longest = interpolate(1.5, MAX_ENTRANCE_DELAY, recipe.parameters.space);
  const unit = macroUnit(recipe.seed, `downbeat:${lane.id}:${lane.role}`);
  return Math.round(interpolate(0.5, longest, unit) * 4) / 4;
}

function createIdentity(
  recipe: GenerationRecipe,
  lane: RoleLaneRecipe,
  roleInstance: number,
): OrchestralIdentity {
  const identityIndex = roleInstance % IDENTITY_NAMES.length;
  return {
    name: IDENTITY_NAMES[identityIndex]!,
    registerOffset: REGISTER_OFFSETS[identityIndex]!,
    harmonicRotation: roleInstance,
    stability: STABILITY[identityIndex]!,
    ...(lane.role === "bass" && lane.style === "articulated"
      ? { articulationFamily: selectBassArticulationFamily(recipe.seed, roleInstance) }
      : {}),
  };
}

function selectBassArticulationFamily(
  seed: number,
  roleInstance: number,
): BassArticulationFamily {
  const base = deriveSeed(seed, "bass-articulation-family")
    % BASS_ARTICULATION_FAMILIES.length;
  return BASS_ARTICULATION_FAMILIES[
    (base + roleInstance) % BASS_ARTICULATION_FAMILIES.length
  ]!;
}

function createSiblingPaths(
  recipe: GenerationRecipe,
  paths: readonly HarmonicPath[],
  identity: OrchestralIdentity,
): HarmonicPath[] {
  if (identity.harmonicRotation === 0) {
    return paths.map((path) => ({
      ...path,
      events: path.events.map((event) => ({ ...event, pitches: [...event.pitches] })),
    }));
  }
  const allowed = createAllowedPitches(recipe, 22, 96);
  return paths.map((path) => ({
    ...path,
    events: path.events.map((event, eventIndex) => ({
      ...event,
      pitches: transformSiblingVoicing(
        event.pitches,
        allowed,
        identity.harmonicRotation + (identity.stability < 0.6 ? eventIndex % 2 : 0),
      ),
    })),
  }));
}

function transformSiblingVoicing(
  pitches: readonly number[],
  allowed: readonly number[],
  roleInstance: number,
): number[] {
  const direction = roleInstance % 2 === 0 ? -1 : 1;
  const scaleSteps = 1 + Math.floor((roleInstance - 1) / 2) % 2;
  const preferredVoice = (roleInstance + 1) % pitches.length;
  const voiceOrder = Array.from(
    { length: pitches.length },
    (_, offset) => (preferredVoice + offset) % pitches.length,
  );

  for (const voice of voiceOrder) {
    const pitchIndex = allowed.indexOf(pitches[voice]!);
    const replacement = allowed[pitchIndex + direction * scaleSteps];
    if (replacement === undefined) continue;
    const candidate = [...pitches];
    candidate[voice] = replacement;
    if (candidate.every((pitch, index) => index === 0 || pitch > candidate[index - 1]!)) {
      return candidate;
    }
  }
  return [...pitches];
}
