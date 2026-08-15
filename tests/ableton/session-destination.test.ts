import { describe, expect, it } from "bun:test";
import type { ExtensionContext, Handle } from "@ableton-extensions/sdk";

import {
  getDestinationState,
  writeGeneratedMatrix,
} from "../../src/ableton/session-destination";
import { generate, type GenerationRecipe } from "../../src/generation/generate";

interface FakeClip {
  name: string;
  looping: boolean;
  notes: unknown[];
}

interface FakeSlot {
  readonly handle: Handle;
  clip: FakeClip | null;
  deleteClip(): Promise<void>;
  createMidiClip(length: number): Promise<FakeClip>;
}

interface FakeTrack {
  readonly handle: Handle;
  readonly name: string;
  readonly midi: boolean;
  readonly clipSlots: FakeSlot[];
}

function createSlot(id: bigint, occupied = false): FakeSlot {
  const slot: FakeSlot = {
    handle: { id },
    clip: occupied ? { name: "Existing", looping: true, notes: [] } : null,
    async deleteClip() { slot.clip = null; },
    async createMidiClip(_length) {
      const clip = { name: "", looping: false, notes: [] };
      slot.clip = clip;
      return clip;
    },
  };
  return slot;
}

function createTrack(id: bigint, name: string, slots: FakeSlot[], midi = true): FakeTrack {
  return { handle: { id }, name, midi, clipSlots: slots };
}

function createFakeContext(tracks: FakeTrack[]) {
  const appendedSceneNames: string[] = [];
  let nextSlotId = 1_000n;
  let transactionCount = 0;
  const song = {
    tracks,
    async createScene(_index: number) {
      for (const track of tracks) track.clipSlots.push(createSlot(nextSlotId++));
      return {
        get name() { return appendedSceneNames.at(-1) ?? ""; },
        set name(value: string) { appendedSceneNames.push(value); },
      };
    },
  };
  const context = {
    application: { song },
    getObjectFromHandle(handle: Handle) {
      const track = tracks.find((candidate) => candidate.handle.id === handle.id);
      if (!track?.midi) throw new Error("wrong type");
      return track;
    },
    withinTransaction<T>(callback: () => T): T {
      transactionCount += 1;
      return callback();
    },
  } as unknown as ExtensionContext<"1.0.0">;

  return {
    context,
    tracks,
    appendedSceneNames,
    get transactionCount() { return transactionCount; },
  };
}

const recipe: GenerationRecipe = {
  engineVersion: 3,
  seed: 42,
  parameters: {
    rootPitchClass: 0,
    scale: { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11] },
    motion: 0.5,
    tension: 0.4,
    space: 0.65,
  },
  lanes: [
    { id: "track-0", role: "bass", octaveOffset: 0, enabled: true },
    { id: "track-1", role: "pad", octaveOffset: 0, enabled: true },
  ],
};

describe("session destination adapter", () => {
  it("discovers the consecutive MIDI block and reports per-track occupancy", () => {
    const anchor = createSlot(1n);
    const fake = createFakeContext([
      createTrack(100n, "Bass", [anchor, createSlot(2n, true)]),
      createTrack(200n, "Pad", [createSlot(3n), createSlot(4n)]),
      createTrack(300n, "Audio", [createSlot(5n), createSlot(6n)], false),
      createTrack(400n, "Ignored MIDI", [createSlot(7n), createSlot(8n)]),
    ]);

    expect(getDestinationState(fake.context, anchor.handle)).toEqual({
      occupiedCount: 1,
      missingSceneCount: 2,
      lanes: [
        { id: "track-0", trackName: "Bass", occupiedCount: 1 },
        { id: "track-1", trackName: "Pad", occupiedCount: 0 },
      ],
    });
    expect(getDestinationState(fake.context, anchor.handle, ["track-1"]).occupiedCount)
      .toBe(0);
  });

  it("appends missing rows once and writes the whole matrix in one transaction", async () => {
    const anchor = createSlot(1n);
    const fake = createFakeContext([
      createTrack(100n, "Bass", [anchor, createSlot(2n)]),
      createTrack(200n, "Pad", [createSlot(3n), createSlot(4n)]),
    ]);

    await writeGeneratedMatrix(fake.context, anchor.handle, generate(recipe), false);

    expect(fake.transactionCount).toBe(1);
    expect(fake.tracks.every((track) => track.clipSlots.length === 4)).toBe(true);
    expect(fake.appendedSceneNames).toEqual(["Tension", "Release"]);
    expect(fake.tracks[0]!.clipSlots.map((slot) => slot.clip?.name)).toEqual([
      "Foundation — Bass", "Development — Bass", "Tension — Bass", "Release — Bass",
    ]);
    expect(fake.tracks[1]!.clipSlots.map((slot) => slot.clip?.name)).toEqual([
      "Foundation — Pad", "Development — Pad", "Tension — Pad", "Release — Pad",
    ]);
    expect(fake.tracks.flatMap((track) => track.clipSlots)
      .every((slot) => (slot.clip?.notes.length ?? 0) > 0)).toBe(true);
  });

  it("preflights every lane before refusing an unapproved overwrite", async () => {
    const anchor = createSlot(1n);
    const occupied = createSlot(6n, true);
    const fake = createFakeContext([
      createTrack(100n, "Bass", [anchor, createSlot(2n), createSlot(3n), createSlot(4n)]),
      createTrack(200n, "Pad", [createSlot(5n), occupied, createSlot(7n), createSlot(8n)]),
    ]);

    await expect(
      writeGeneratedMatrix(fake.context, anchor.handle, generate(recipe), false),
    ).rejects.toThrow("became occupied");
    expect(anchor.clip).toBeNull();
    expect(occupied.clip?.name).toBe("Existing");
  });
});
