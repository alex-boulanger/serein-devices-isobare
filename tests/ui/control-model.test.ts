import { describe, expect, test } from "bun:test";

import {
  moveOptionIndex,
  parseSeedDraft,
  selectedOptionIndex,
  type SelectOption,
} from "../../src/ui/shared/controls/control-model";

const options: readonly SelectOption[] = [
  { value: "bass", label: "Bass" },
  { value: "pad", label: "Pad" },
  { value: "lead", label: "Lead" },
];

describe("custom select model", () => {
  test("locates the selected option and falls back to the first", () => {
    expect(selectedOptionIndex(options, "pad")).toBe(1);
    expect(selectedOptionIndex(options, "missing")).toBe(0);
  });

  test("wraps keyboard navigation at both ends", () => {
    expect(moveOptionIndex(options.length, 2, 1)).toBe(0);
    expect(moveOptionIndex(options.length, 0, -1)).toBe(2);
  });
});

describe("seed input model", () => {
  test("parses unsigned integer drafts", () => {
    expect(parseSeedDraft("0")).toBe(0);
    expect(parseSeedDraft("4294967295")).toBe(4294967295);
  });

  test("keeps incomplete and malformed drafts invalid", () => {
    expect(parseSeedDraft("")).toBeNaN();
    expect(parseSeedDraft("12.5")).toBeNaN();
    expect(parseSeedDraft("-1")).toBeNaN();
  });
});
