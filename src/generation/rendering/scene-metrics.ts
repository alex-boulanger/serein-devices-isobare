import {
  averageSpacing,
  measureTension,
  totalMovement,
} from "../planning/composition-plan";
import type { HarmonicPath, SceneMetrics } from "../types";
import type { RenderedRole } from "./types";

export function createSceneMetrics(
  path: HarmonicPath,
  rendered: RenderedRole,
): SceneMetrics {
  return {
    noteCount: rendered.notes.length,
    mutationCount: rendered.mutationCount,
    densityChangeCount: rendered.densityChangeCount,
    averageMovement: averagePathMovement(path),
    averageSpacing: averagePathSpacing(path),
    averageTension: averagePathTension(path),
  };
}

function averagePathMovement(path: HarmonicPath): number {
  if (path.events.length < 2) return 0;
  const total = path.events.slice(1).reduce(
    (sum, event, index) => sum + totalMovement(path.events[index]!.pitches, event.pitches),
    0,
  );
  return total / (path.events.length - 1);
}

function averagePathSpacing(path: HarmonicPath): number {
  if (path.events.length === 0) return 0;
  return path.events.reduce((sum, event) => sum + averageSpacing(event.pitches), 0)
    / path.events.length;
}

function averagePathTension(path: HarmonicPath): number {
  if (path.events.length === 0) return 0;
  return path.events.reduce(
    (total, event) => total + measureTension(event.pitches),
    0,
  ) / path.events.length;
}
