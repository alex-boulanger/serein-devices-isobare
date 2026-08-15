import {
  mutationBudget,
  pitchForClassNear,
  renderMonophonicSegments,
  selectPathEvents,
} from "./note-mechanics";
import type { RenderedRole, RoleRenderContext } from "./types";

export function renderDrone(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration } = context;
  const selected = selectPathEvents(
    path,
    mutationBudget(recipe, path.scene, "drone"),
  );
  const pitches = selected.map((_event, index) => {
    const pitchClass = plan.transitionAnchors[
      (index + orchestration.roleInstance) % plan.transitionAnchors.length
    ] ?? plan.pitchHierarchy.root;
    return pitchForClassNear(pitchClass, index === 0 ? 38 : 43, 28, 60);
  });
  return renderMonophonicSegments(
    selected.map((event) => event.beat),
    pitches,
    "drone",
  );
}
