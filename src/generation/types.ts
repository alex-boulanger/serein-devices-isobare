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

export const SCENE_NUMERALS: Readonly<Record<SceneKind, string>> = {
  foundation: "I",
  development: "II",
  tension: "III",
  release: "IV",
};

/**
 * How the Scene Arc is spelled in generated clip names. Descriptive names read
 * clearly on their own; numerals stay compact once a Session View is full of
 * lanes and the arc is already familiar.
 */
export const SCENE_LABEL_STYLES = ["name", "numeral"] as const;
export type SceneLabelStyle = (typeof SCENE_LABEL_STYLES)[number];

export const SCENE_LABEL_STYLE_NAMES: Readonly<Record<SceneLabelStyle, string>> = {
  name: "Names",
  numeral: "I–IV",
};

export function sceneLabel(
  scene: SceneKind,
  style: SceneLabelStyle = "name",
): string {
  return style === "numeral" ? SCENE_NUMERALS[scene] : SCENE_NAMES[scene];
}

export const MUSICAL_ROLES = [
  "bass",
  "pad",
  "drone",
  "arp-source",
  "lead",
] as const;
export type MusicalRole = (typeof MUSICAL_ROLES)[number];

export const ROLE_NAMES: Readonly<Record<MusicalRole, string>> = {
  bass: "Bass",
  pad: "Pad",
  drone: "Drone",
  "arp-source": "Arp Source",
  lead: "Lead",
};

export const LEAD_STYLES = ["pluck", "flow"] as const;
export type LeadStyle = (typeof LEAD_STYLES)[number];

export const BASS_STYLES = ["articulated", "sustained"] as const;
export type BassStyle = (typeof BASS_STYLES)[number];

export type RoleStyle = BassStyle | LeadStyle;

export const ROLE_STYLES: Readonly<
  Partial<Record<MusicalRole, readonly RoleStyle[]>>
> = {
  bass: BASS_STYLES,
  lead: LEAD_STYLES,
};

export const ROLE_STYLE_NAMES: Readonly<Record<RoleStyle, string>> = {
  articulated: "Articulated",
  sustained: "Sustained",
  pluck: "Pluck",
  flow: "Flow",
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
  /**
   * How far material may depart from its own plan: octave displacement, how
   * deeply ornaments are thinned between passes, and whether the Melodic Motif
   * is developed rather than restated. The other three macros shape what the
   * plan contains; this one decides how faithfully it is followed. Absent means
   * none, so a recipe without it renders exactly as before.
   */
  readonly drift?: number;
}

export interface RoleLaneRecipe {
  readonly id: string;
  readonly role: MusicalRole;
  readonly octaveOffset: number;
  readonly enabled: boolean;
  readonly style?: RoleStyle;
}

export interface GenerationRecipe {
  readonly engineVersion: 6;
  readonly seed: number;
  readonly parameters: GenerationParameters;
  readonly lanes: readonly RoleLaneRecipe[];
  /** Naming only; it never changes a single note. Defaults to "name". */
  readonly sceneLabelStyle?: SceneLabelStyle;
}

export interface GeneratedNote {
  readonly pitch: number;
  readonly startTime: number;
  readonly duration: number;
  readonly velocity: number;
  /**
   * Chance that Live sounds this note on a given pass, per ADR 0009. Absent
   * means guaranteed: structural material and Transition Anchors always sound,
   * and only ornament or connective notes carry a value below 1.
   */
  readonly probability?: number;
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
  readonly melodicMotif: MelodicMotif;
}

export interface MelodicMotif {
  readonly scaleDegrees: readonly number[];
  readonly rhythm: readonly number[];
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
  readonly style?: RoleStyle;
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
