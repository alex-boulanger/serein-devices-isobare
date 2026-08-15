export const SCENE_KINDS = [
  "foundation",
  "development",
  "tension",
  "release",
] as const;

export type SceneKind = (typeof SCENE_KINDS)[number];

export const SCENE_NAMES: Readonly<Record<SceneKind, string>> = {
  foundation: "Foundation",
  development: "Development",
  tension: "Tension",
  release: "Release",
};

export const MUSICAL_ROLES = ["bass", "pad", "drone", "arp-source"] as const;
export type MusicalRole = (typeof MUSICAL_ROLES)[number];

export const ROLE_NAMES: Readonly<Record<MusicalRole, string>> = {
  bass: "Bass",
  pad: "Pad",
  drone: "Drone",
  "arp-source": "Arp Source",
};

export const BASS_ARTICULATION_FAMILIES = [
  "pedal",
  "breath",
  "call",
  "drift",
  "pickup",
] as const;
export type BassArticulationFamily = (typeof BASS_ARTICULATION_FAMILIES)[number];

export interface ScaleDefinition {
  readonly name: string;
  readonly intervals: readonly number[];
}

export interface GenerationParameters {
  readonly rootPitchClass: number;
  readonly scale: ScaleDefinition;
  readonly motion: number;
  readonly tension: number;
  readonly space: number;
}

export interface RoleLaneRecipe {
  readonly id: string;
  readonly role: MusicalRole;
  readonly octaveOffset: number;
  readonly enabled: boolean;
}

export interface GenerationRecipe {
  readonly engineVersion: 4;
  readonly seed: number;
  readonly parameters: GenerationParameters;
  readonly lanes: readonly RoleLaneRecipe[];
}

export interface GeneratedNote {
  readonly pitch: number;
  readonly startTime: number;
  readonly duration: number;
  readonly velocity: number;
}

export interface HarmonicEvent {
  readonly beat: number;
  readonly pitches: readonly number[];
}

export interface HarmonicPath {
  readonly scene: SceneKind;
  readonly events: readonly HarmonicEvent[];
}

export interface PitchHierarchy {
  readonly root: number;
  readonly anchors: readonly number[];
  readonly colors: readonly number[];
  readonly rare: readonly number[];
}

export interface CompositionPlan {
  readonly pitchHierarchy: PitchHierarchy;
  readonly transitionAnchors: readonly number[];
  readonly paths: readonly HarmonicPath[];
}

export interface SceneMetrics {
  readonly noteCount: number;
  readonly mutationCount: number;
  readonly densityChangeCount: number;
  readonly averageMovement: number;
  readonly averageSpacing: number;
  readonly averageTension: number;
}

export interface GeneratedScene {
  readonly kind: SceneKind;
  readonly name: string;
  readonly durationBeats: 32;
  readonly notes: readonly GeneratedNote[];
  readonly metrics: SceneMetrics;
}

export interface GenerationMetrics {
  readonly durationBeats: 32;
  readonly noteCount: number;
  readonly sceneCount: 4;
  readonly laneCount: number;
}

export interface GeneratedLane {
  readonly id: string;
  readonly role: MusicalRole;
  readonly roleInstance: number;
  readonly octaveOffset: number;
  readonly identity: OrchestralIdentity;
  readonly harmonicPaths: readonly HarmonicPath[];
  readonly scenes: readonly GeneratedScene[];
}

export interface OrchestralIdentity {
  readonly name: string;
  readonly registerOffset: number;
  readonly harmonicRotation: number;
  readonly stability: number;
  readonly articulationFamily?: BassArticulationFamily;
}

export interface GenerationResult {
  readonly recipe: GenerationRecipe;
  readonly plan: CompositionPlan;
  readonly lanes: readonly GeneratedLane[];
  readonly metrics: GenerationMetrics;
  readonly diagnostics: readonly string[];
}
