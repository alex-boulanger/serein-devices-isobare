# Ambient Harmony Generator

Ableton Live extension bootstrap using TypeScript, Bun, and Svelte 5.

## Develop

Requires Bun 1.3+, Node.js 24.16+, and an Extensions-enabled Ableton Live beta
with Developer Mode enabled.

The SDK release is intentionally gitignored. Put it at this exact path before
installing:

```text
extensions-sdk-1.0.0-beta.1/
├── ableton-extensions-cli-1.0.0-beta.1.tgz
└── ableton-extensions-sdk-1.0.0-beta.1.tgz
```

```sh
bun install
bun test
bun run start
```

In Live's Session View, right-click an empty clip slot and choose
**Generate ambient matrix…**. The slot is the upper-left corner of the result.
Choose which consecutive MIDI tracks to include, assign Bass, Pad, Drone, or
Arp Source to each, then generate four related eight-bar Scene rows. The first
non-MIDI track ends the block. Occupied cells require explicit overwrite consent;
the complete matrix is one undo step.

## Build the extension

```sh
bun run package
```

This creates `Ambient-Harmony-Generator-0.0.1.ablx` in the project root.
