import {
  createBassArticulation,
  mergeContiguousBassNotes,
} from "./bass-articulation";
import {
  createNote,
  latestAt,
  mutationBudget,
  ornamentProbability,
  pitchForClassNear,
  selectPathEvents,
} from "./note-mechanics";
import { driftOf } from "../macros";
import type { CompositionPlan } from "../types";
import type { RenderedRole, RoleRenderContext } from "./types";

export function renderBass(context: RoleRenderContext): RenderedRole {
  switch (context.orchestration.lane.style) {
    case "articulated": return renderArticulatedBass(context);
    case "sustained": return renderSustainedBass(context);
    default: throw new Error("A Bass lane requires an Articulated or Sustained style.");
  }
}

function renderArticulatedBass(context: RoleRenderContext): RenderedRole {
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
    recipe.parameters.space,
    profile.densityScale,
    orchestration.downbeatOffset,
  );
  const notes = mergeContiguousBassNotes(articulation.map((event, index) => {
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
      // The phrase's opening attack establishes the harmony and is guaranteed;
      // the attacks that follow it are connective and may vary per pass.
      ...(index === 0
        ? {}
        : {
            probability: ornamentProbability(
              laneSeed,
              `bass:${path.scene}:${event.beat}`,
              driftOf(recipe.parameters),
            ),
          }),
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

function renderSustainedBass(context: RoleRenderContext): RenderedRole {
  const { recipe, plan, path, orchestration } = context;
  const { roleInstance } = orchestration;
  const selected = selectPathEvents(
    path,
    mutationBudget(recipe, path.scene, "bass"),
  );
  const notes = mergeContiguousBassNotes(selected.map((event, index) => {
    const nextBeat = selected[index + 1]?.beat ?? 32;
    return createNote(
      bassPitchForEvent(event.pitches, plan, index + roleInstance),
      event.beat,
      nextBeat - event.beat,
      "bass",
    );
  }));

  return {
    notes,
    mutationCount: Math.max(0, notes.length - 1),
    densityChangeCount: 0,
  };
}

/**
 * The Bass sounds the harmony standing above it rather than a fixed anchor
 * cycle, so it moves when the Harmonic Path moves. It grounds that harmony on
 * its anchor tones and only takes a colour tone when the sounding harmony
 * offers no anchor at all — colour is cheap in the middle register and muddy
 * at the bottom. Siblings offset the index and land elsewhere in the same set.
 */
function bassPitchForEvent(
  harmony: readonly number[],
  plan: CompositionPlan,
  eventIndex: number,
): number {
  const sounding = unique(harmony.map((pitch) => ((pitch % 12) + 12) % 12));
  if (sounding.length === 0) {
    return pitchForClassNear(plan.pitchHierarchy.root, 36, 24, 48);
  }

  const anchored = sounding.filter((pitchClass) =>
    plan.pitchHierarchy.anchors.includes(pitchClass),
  );
  const candidates = anchored.length > 0 ? anchored : sounding;
  const pitchClass = candidates[eventIndex % candidates.length]!;
  return pitchForClassNear(pitchClass, eventIndex % 2 === 0 ? 36 : 41, 24, 48);
}

function unique(values: readonly number[]): number[] {
  return [...new Set(values)];
}
