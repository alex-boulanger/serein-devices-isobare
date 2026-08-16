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
  // A Drone that does not own the downbeat enters behind whichever lane does.
  const beats = selected.map((event) => event.beat);
  const nextBeat = beats[1] ?? 32;
  beats[0] = Math.min(orchestration.downbeatOffset, nextBeat - 1);

  return renderMonophonicSegments(beats, pitches, "drone", path.scene);
}
