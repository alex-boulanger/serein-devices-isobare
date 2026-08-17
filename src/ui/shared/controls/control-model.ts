export type ControlValue = string | number;

export interface SelectOption {
  readonly value: ControlValue;
  readonly label: string;
}

export function selectedOptionIndex(
  options: readonly SelectOption[],
  value: ControlValue,
): number {
  const index = options.findIndex((option) => option.value === value);
  return index < 0 ? 0 : index;
}

export function moveOptionIndex(
  length: number,
  current: number,
  delta: number,
): number {
  if (length === 0) return 0;
  return (current + delta + length) % length;
}

export function parseSeedDraft(draft: string): number {
  return /^\d+$/.test(draft) ? Number(draft) : Number.NaN;
}
