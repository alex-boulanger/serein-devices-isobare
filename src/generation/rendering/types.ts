import type {
  CompositionPlan,
  GeneratedNote,
  GenerationRecipe,
  HarmonicPath,
} from "../types";
import type {
  OrchestratedLane,
  SceneProfile,
} from "../planning/orchestration";

export interface RoleRenderContext {
  readonly recipe: GenerationRecipe;
  readonly plan: CompositionPlan;
  readonly path: HarmonicPath;
  readonly orchestration: OrchestratedLane;
  readonly profile: SceneProfile;
  readonly laneSeed: number;
}

export interface RenderedRole {
  readonly notes: readonly GeneratedNote[];
  readonly mutationCount: number;
  readonly densityChangeCount: number;
}
