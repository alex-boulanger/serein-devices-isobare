# Generation engine

`generate(recipe)` is the engine's public interface. It accepts serializable input
and returns a deterministic composition matrix without depending on Ableton or the UI.

## Modules

- `generate.ts` validates and coordinates one generation run.
- `planning/` creates the shared harmonic plan and assigns complementary lane identities.
- `rendering/` realizes each planned lane as role-specific MIDI notes.
- `types.ts` defines the public recipe and result contract.
- `random.ts` provides deterministic seeded randomness.

## Dependency rule

Dependencies point inward from `generate.ts` to planning and rendering. Rendering may
consume planning results; planning must not import rendering. Ableton SDK objects,
handles, modal state, and filesystem concerns do not belong in this directory.

Keep internal helpers private unless another engine module genuinely consumes them.
Behavioral tests should call `generate(recipe)` so the engine can be refactored without
coupling tests to its current implementation.

When adding a musical role, put its realization in `rendering/` and connect it in
`rendering/render-lane.ts`. Do not add role-specific logic to the public facade.
