import { createAllowedPitches } from "./composition-plan";
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
}

const ROLE_ACTIVITY: Readonly<
  Record<MusicalRole, Readonly<Record<SceneKind, number>>>
> = {
  bass: { foundation: 1, development: 0.9, tension: 0.75, release: 0.65 },
  pad: { foundation: 0.85, development: 1, tension: 0.9, release: 0.65 },
  drone: { foundation: 1, development: 0.75, tension: 0.6, release: 0.85 },
  "arp-source": { foundation: 0.65, development: 0.85, tension: 1, release: 0.55 },
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

  return enabled.map((lane) => {
    const roleInstance = roleCounts.get(lane.role) ?? 0;
    roleCounts.set(lane.role, roleInstance + 1);
    const identity = createIdentity(recipe, lane.role, roleInstance);
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
    };
  });
}

function createIdentity(
  recipe: GenerationRecipe,
  role: MusicalRole,
  roleInstance: number,
): OrchestralIdentity {
  const identityIndex = roleInstance % IDENTITY_NAMES.length;
  return {
    name: IDENTITY_NAMES[identityIndex]!,
    registerOffset: REGISTER_OFFSETS[identityIndex]!,
    harmonicRotation: roleInstance,
    stability: STABILITY[identityIndex]!,
    ...(role === "bass"
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
