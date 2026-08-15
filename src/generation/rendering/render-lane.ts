import { deriveSeed } from "../random";
import { CLIP_LENGTH_BEATS } from "../planning/composition-plan";
import type { OrchestratedLane } from "../planning/orchestration";
import {
  ROLE_NAMES,
  SCENE_NAMES,
  type CompositionPlan,
  type GeneratedScene,
  type GenerationRecipe,
} from "../types";
import { renderBass } from "./bass";
import { renderDrone } from "./drone";
import { transposeIntoMidiRange } from "./note-mechanics";
import { createSceneMetrics } from "./scene-metrics";
import { renderArpSource, renderPad } from "./sustained-harmony";
import type { RenderedRole, RoleRenderContext } from "./types";

export function renderLaneScenes(
  recipe: GenerationRecipe,
  plan: CompositionPlan,
  orchestration: OrchestratedLane,
): GeneratedScene[] {
  const { lane, roleInstance, identity } = orchestration;
  const laneSeed = deriveSeed(recipe.seed, `lane:${lane.id}:${lane.role}:${roleInstance}`);
  const roleName = `${ROLE_NAMES[lane.role]}${roleInstance > 0 ? ` ${roleInstance + 1}` : ""}`;

  return orchestration.harmonicPaths.map((path) => {
    const context: RoleRenderContext = {
      recipe,
      plan,
      path,
      orchestration,
      profile: orchestration.profiles[path.scene],
      laneSeed,
    };
    const rendered = renderRole(context);
    return {
      kind: path.scene,
      name: `${SCENE_NAMES[path.scene]} — ${roleName}`,
      durationBeats: CLIP_LENGTH_BEATS,
      notes: rendered.notes.map((note) => ({
        ...note,
        pitch: transposeIntoMidiRange(
          note.pitch,
          identity.registerOffset + lane.octaveOffset * 12,
        ),
      })),
      metrics: createSceneMetrics(path, rendered),
    };
  });
}

function renderRole(context: RoleRenderContext): RenderedRole {
  switch (context.orchestration.lane.role) {
    case "bass": return renderBass(context);
    case "pad": return renderPad(context);
    case "drone": return renderDrone(context);
    case "arp-source": return renderArpSource(context);
  }
}
