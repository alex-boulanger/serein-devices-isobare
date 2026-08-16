const PITCH_CLASS_NAMES = [
  "c",
  "c♯",
  "d",
  "e♭",
  "e",
  "f",
  "f♯",
  "g",
  "a♭",
  "a",
  "b♭",
  "b",
] as const;

/** Live names middle C as C3, so MIDI 60 reads as c3. */
export function pitchName(pitch: number): string {
  const rounded = Math.round(pitch);
  const name = PITCH_CLASS_NAMES[((rounded % 12) + 12) % 12] ?? "c";
  return `${name}${Math.floor(rounded / 12) - 2}`;
}

export function pitchClassName(pitchClass: number): string {
  return PITCH_CLASS_NAMES[((pitchClass % 12) + 12) % 12] ?? "c";
}

/** Compact enough for the lane control column; the full phrase is the title. */
export function octaveLabel(offset: number): string {
  if (offset === 0) return "0";
  return `${offset > 0 ? "+" : "−"}${Math.abs(offset)}`;
}

export function octaveTitle(offset: number): string {
  if (offset === 0) return "as generated";
  const plural = Math.abs(offset) === 1 ? "octave" : "octaves";
  return `${offset > 0 ? "up" : "down"} ${Math.abs(offset)} ${plural}`;
}

export function countLabel(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}
