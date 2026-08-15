# PRD — Ambient Session Generator

**Status:** Initial matrix generation implemented and tested in Live  
**Next milestone:** Bass Articulation Motifs and global orchestration  
**Platform:** Ableton Live Extensions SDK  
**Default duration:** Eight bars of 4/4 (32 quarter-note beats)

## 1. Product direction

Ambient Session Generator creates coherent, slowly evolving MIDI material for performing ambient music in Ableton Live's Session View. Its long-term output is an Ambient Session: a matrix of related Scene rows and Musical Role columns derived from one Composition Plan.

The extension is intended for a Prepared Template. Users own the tracks, instruments, effects, and performance mix. The extension composes MIDI; it does not build or manage the sound-design environment.

The defining behavior is evolving voicing rather than conventional block-chord progression:

> Preserve a harmonic identity while individual voices change slowly, irregularly, and coherently.

## 2. Product architecture and delivery scope

### Long-term product

The complete product generates a matrix with:

- Four related Scenes: Foundation, Development, Tension, and Release.
- One to eight Role Lanes.
- Musical Roles: Bass, Pad, Drone, Arp Source, Melody, and Arp Line.
- Repeated roles treated as alternative Role Variants with stable Orchestral Identities.
- Mix Resilience when roles are muted during performance.

### Current milestone

The selected clip slot is the upper-left anchor. Up to eight consecutive MIDI tracks form the Role Lane block; the first non-MIDI track ends it. The selected Scene row and following three rows receive Foundation, Development, Tension, and Release. Missing rows are appended; existing scenes are not renamed.

The user explicitly includes or excludes each discovered lane, assigns its Musical Role, and may offset its register by up to two octaves. Live track order is preserved. One Composition Plan coordinates the complete matrix. The next milestone deepens this into explicit Scene Profiles, Role Families, sibling Harmonic Paths, global density ceilings, and stable Orchestral Identities.

## 3. User workflow

1. The user right-clicks one Session View clip slot and chooses **Generate ambient matrix…**.
2. The extension reads Live's project scale. If Scale Mode is disabled, it uses C major.
3. The modal lists the consecutive MIDI tracks and lets the user include each one, assign Bass, Pad, Drone, or Arp Source, and choose an octave offset.
4. The modal exposes Motion, Tension, Space, and Seed. Scene duration is fixed at 32 beats for this milestone.
5. The extension preflights all enabled lanes across the four target Scene rows.
6. Occupied destinations are preserved unless the user explicitly enables **Overwrite occupied clips**. The modal reports the occupied count.
7. Apply writes the complete matrix in one Live undo transaction.

Existing scenes keep their names. Generated clips use readable names:

```text
Foundation — Pad
Development — Pad
Tension — Pad
Release — Pad
```

## 4. Scene Arc

Scenes are independently loopable energy states, not mandatory sections of a linear song.

### Foundation

- Establishes the Pitch Hierarchy and identity.
- Sparse, stable, and open.
- Remains close to the Transition Anchor.
- Pad and Arp Source use a closed `2 → 3 → 2` audible-voice contour.
- Uses the lowest global movement, anchor-heavy harmony, and sparse Foreground Allocation.

### Development

- Transforms Foundation rather than replacing it.
- Transfers activity between roles rather than merely adding notes.
- Preserves recognizable anchors and exact common tones.
- Pad and Arp Source use a `3 → 2 → 3` audible-voice contour.
- Role Variants begin to diverge through sibling Harmonic Paths.

### Tension

- Introduces color degrees, closer intervals, and register pressure.
- Preserves enough identity tones to remain part of the same musical world.
- Does not require functional dominant harmony.
- Pad sustains four audible voices; Arp Source may briefly expand from four to five.
- Selectively increases color-tone exposure, interval friction, upper-register pressure, and foreground activity; not every lane becomes busy.

### Release

- Acts as an exhalation: reduces pressure while permitting some unresolved color.
- Recalls Foundation without copying it.
- Returns toward compatible Transition Anchor material.
- Pad and Arp Source contract from three audible voices to a plain root/anchor dyad.
- Lengthens breathing space and recalls Foundation without becoming a weaker copy of it.

## 5. Composition Plan

One deterministic Composition Plan is generated before any clips are rendered. It contains at least:

- Project root and scale.
- Pitch Hierarchy.
- Transition Anchor pitch classes.
- Canonical Foundation material.
- Four related Harmonic Paths.
- Scene energy profiles.
- Session, Scene, and Role seed derivations.

### Pitch Hierarchy

Scale membership is necessary but insufficient. The plan assigns distinct functions to scale degrees:

- The project root is the primary gravitational center.
- Two or three anchor degrees provide persistent identity.
- Color degrees provide controlled tension and movement.
- Rare degrees remain available but are selected deliberately.

The root need not sound continuously. Foundation and Release favor it near loop boundaries; Development and Tension may omit it for extended periods.

### Transition Anchor

All Scenes gravitate toward compatible pitch-class material in their opening and closing regions. They do not share a mandatory boundary chord or identical voicing.

This supports loops and future arbitrary Scene changes without creating an obvious eight-bar reset.

## 6. Harmonic Path generation

The engine plans complete Harmonic Paths before rendering notes.

1. Create canonical Foundation material.
2. Search bounded whole-path candidates.
3. Score internal evolution, loop closure, and Transition Anchor compatibility.
4. Derive Development, Tension, and Release through constrained transformations.
5. Accept the complete four-Scene plan.
6. Orchestrate and render every enabled Musical Role Lane.

Bounded deterministic search, such as beam search, is preferred over greedy commitment to each locally attractive mutation.

### Evolving-voicing rules

- Pad begins with a persistent three-to-five-voice voicing.
- Mutations normally move exactly one voice.
- Adjacent states preserve most exact MIDI pitches.
- Mutation times are irregular and avoid a uniform two-bar grid.
- Simultaneous multi-voice movement is rare and strongly penalized.
- Loop closure is evaluated as part of the path, not repaired after rendering.
- Consonant and triadic sonorities are allowed.

The engine penalizes obvious chord-machine behavior:

- Dividing the clip into four equal chord blocks.
- Moving several voices together repeatedly.
- Repeating root-position major or minor triads.
- Strong fifth-descending bass motion into the project root.
- Explicit dominant-to-tonic resolution.
- Reusing identical harmonic rhythm across every Scene.

## 7. Musical Role contracts

### Bass

- Monophonic.
- Default register approximately C1–C3.
- Favors anchor tones but is not forced to play the project root.
- Structural, sparse movement.

### Pad

- Four persistent voices in the Harmonic Path, with two to four rendered audibly according to the Scene contour.
- Default register approximately C2–C5.
- Primary expression of the Harmonic Path.
- Voices evolve asynchronously.

### Drone

- One or two notes.
- Default register approximately C1–C4.
- Strongly favors Transition Anchors.
- May sustain unchanged for the complete Scene Cycle.

### Arp Source

- Three to five sustained notes.
- Default register approximately C3–C6.
- Supplies pitch sets for Ableton Live's Arpeggiator.
- The extension does not generate arpeggio rhythm or insert a device.

## 8. Default mutation budgets

Counts represent meaningful voice mutations or pitch-set changes across one eight-bar Scene Cycle, not emitted arpeggiator notes.

| Role | Foundation | Development | Tension | Release |
|---|---:|---:|---:|---:|
| Bass | 0–1 | 1–2 | 1–2 | 0–1 |
| Pad | 0–1 | 1–2 | 2–4 | 0–1 |
| Drone | 0 | 0–1 | 1 | 0 |
| Arp Source | 0–1 | 1–2 | 1–3 | 0–1 |

These ranges are initial tuning targets rather than promises that randomness must always reach the maximum.

## 9. Sparse but never silent

Every generated clip must:

- Contain at least one note.
- Establish audible material at beat zero.
- Permit internal rests and dropped voices.
- Remain coherent when heard without the other roles.
- Return compatibly toward its Transition Anchor before looping.

The generator does not create intentionally empty clips. Users create empty Session rows or mute tracks when they want silence in a performance.

Minimal composition is preferred over filling available space.

## 10. Time model

The current milestone supports a fixed 32-quarter-note-beat Scene Cycle, described as eight bars of 4/4.

Meter-aware generation is deferred. A destination using another meter may still receive 32 beats, but the extension does not promise that Live will display them as eight bars.

Events within the cycle remain asynchronous and role-specific. Sharing a Scene boundary does not imply that roles change together.

## 11. Determinism and variation foundation

Identical engine version, seed, scale, parameters, and lane configuration must produce identical MIDI.

Seeds are derived hierarchically:

```text
Session seed
├── Composition Plan seed
├── Scene seeds
└── Role Lane and instance seeds
```

This prepares future variations to regenerate a Scene, Role Lane, or cell without discarding the shared Composition Plan. Variation UI and persistent template mappings are not part of the current milestone.

SDK handles must never be persisted.

## 12. User controls

The visible controls are:

- Per-track inclusion, Musical Role, and octave offset.
- Motion: still to evolving.
- Tension: consonant to abrasive.
- Space: compact to open.
- Seed.
- Overwrite occupied clips, default off.

Stability, exploration temperature, density allocation, voice count, Pitch Hierarchy weights, and Scene-specific profiles remain internal until listening tests demonstrate useful and understandable user-facing behavior.

## 13. Architecture boundary

The musical engine has no dependency on Ableton APIs.

```text
Generation request
    ↓
Composition Plan
    ↓
Four complete Harmonic Paths
    ↓
Cross-lane orchestration
    ↓
Role renderers
    ↓
One to eight lanes × four Role Parts + metrics + diagnostics
    ↓
Ableton adapter transaction
```

The result should retain its recipe, generated notes, aggregate metrics, and diagnostics. The Ableton adapter resolves current handles immediately before preflight and again before mutation rather than caching Live objects.

## 14. Acceptance criteria for the current milestone

1. One selected clip slot anchors a matrix across one to eight consecutive MIDI tracks and four Scene rows.
2. Missing following Scene rows are appended.
3. Existing Scene names remain unchanged; generated clip names are readable.
4. Occupied clips require explicit overwrite consent.
5. Apply is grouped into one Live undo step.
6. Live's project scale is respected; disabled Scale Mode falls back to C major.
7. Every note belongs to the selected scale.
8. Every clip is 32 beats, nonempty, and audible from beat zero.
9. Foundation, Development, Tension, and Release are recognizably related transformations.
10. Pad changes normally move one voice while preserving common tones.
11. Mutation counts remain within the role and Scene tuning budgets.
12. The end-to-start loop transition remains within an accepted movement threshold.
13. Equal recipes produce byte-for-byte equivalent note events.
14. The core engine runs and is tested without Ableton Live.
15. Metrics and diagnostics explain why candidate paths were accepted.
16. All enabled lanes share one Composition Plan.
17. Duplicate roles are deterministic but complementary rather than identical.
18. Disabled lanes remain untouched and are excluded from overwrite checks.

## 15. Explicit non-goals for the current milestone

- Creating, deleting, renaming, or reordering tracks.
- Inserting instruments, Arpeggiator, or other devices.
- Crossing a non-MIDI track when discovering the prepared template block.
- Persisting track-to-role mappings between invocations.
- Inferring playable range from track or device names.
- Generating lead melodies, drums, audio, or performed arpeggio rhythms.
- Meter-aware bar conversion.
- Persistent template mappings.
- Intentionally empty clips.
- Conventional chord-progression generation.

## 16. Future matrix expansion

Once the one-lane generator is musically convincing, the adapter may render one to eight Role Lanes from the same Composition Plan. The modal will then support lane inclusion, ordering, duplicate roles, complementary orchestration, and octave offsets for a Prepared Template.

Matrix expansion must preserve the same core contracts; it must not become a loop that independently invokes the one-lane generator for every track.
