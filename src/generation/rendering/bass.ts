import {
  createBassArticulation,
  mergeContiguousBassNotes,
} from "./bass-articulation";
import {
  latestAt,
  mutationBudget,
  pitchForClassNear,
  selectPathEvents,
} from "./note-mechanics";
import type { CompositionPlan } from "../types";
import type { RenderedRole, RoleRenderContext } from "./types";

export function renderBass(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration, laneSeed, profile } = context;
  const { roleInstance, identity } = orchestration;
  const selected = selectPathEvents(
    path,
    mutationBudget(recipe, path.scene, "bass"),
  );
  const articulation = createBassArticulation(
    laneSeed,
    identity.articulationFamily!,
    path.scene,
    recipe.parameters.motion,
    profile.densityScale,
  );
  const notes = mergeContiguousBassNotes(articulation.map((event) => {
    const harmony = latestAt(selected, event.beat);
    const harmonyIndex = selected.indexOf(harmony);
    return {
      pitch: bassPitchForEvent(
        harmony.pitches,
        plan,
        harmonyIndex + roleInstance,
      ),
      startTime: event.beat,
      duration: event.duration,
      velocity: event.velocity,
    };
  }));
  const mutationCount = notes.slice(1).filter(
    (note, index) => note.pitch !== notes[index]!.pitch,
  ).length;
  return {
    notes,
    mutationCount,
    densityChangeCount: Math.max(0, notes.length - 1),
  };
}

function bassPitchForEvent(
  harmony: readonly number[],
  plan: CompositionPlan,
  eventIndex: number,
): number {
  const candidates = unique([
    ...plan.pitchHierarchy.anchors,
    ...harmony.map((pitch) => pitch % 12),
  ]);
  const pitchClass = candidates[eventIndex % candidates.length]
    ?? plan.pitchHierarchy.root;
  return pitchForClassNear(pitchClass, eventIndex % 2 === 0 ? 36 : 41, 24, 48);
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}
