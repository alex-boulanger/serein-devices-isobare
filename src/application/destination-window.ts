interface SlotLike {
  readonly clip: unknown | null;
}

export function inspectDestinationWindow(
  slots: readonly SlotLike[],
  anchorIndex: number,
  sceneCount = 4,
): { readonly occupiedCount: number; readonly missingSceneCount: number } {
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0) {
    throw new Error("Destination anchor index must be a non-negative integer.");
  }

  const available = slots.slice(anchorIndex, anchorIndex + sceneCount);
  return {
    occupiedCount: available.filter((slot) => slot.clip !== null).length,
    missingSceneCount: sceneCount - available.length,
  };
}
