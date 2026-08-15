# Generate the Role matrix as one unit

The generator accepts one versioned recipe containing one to eight Role Lanes. It creates the Composition Plan once, then orchestrates every enabled lane against that shared plan before the Ableton adapter writes any clips.

The selected clip slot is the upper-left anchor. Up to eight consecutive MIDI tracks form the candidate lane block; the first non-MIDI track ends it. The modal makes inclusion, role, and octave offset explicit. Live track order remains authoritative.

## Consequences

- Duplicate roles receive deterministic instance identities and complementary note choices rather than identical copies.
- Disabled lanes are not rendered or preflighted for overwrite.
- The Ableton adapter maps opaque lane ids to current tracks, preflights the complete selected matrix, and writes it in one transaction.
- Track creation, deletion, naming, reordering, and device insertion remain outside the extension.
