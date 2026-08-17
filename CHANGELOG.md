# Changelog

User-facing changes to Isobare. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-08-17

First stable release. Isobare turns one empty Session View slot and up to eight
consecutive MIDI tracks into four related eight-bar scenes: Foundation,
Development, Tension, and Release.

### Added

- Bass, Pad, Drone, Arp Source, and Lead roles with role-specific register,
  density, phrasing, and available styles.
- Motion, Tension, Space, Drift, and Seed controls with a complete matrix preview.
- Live scale awareness, deterministic regeneration, octave offsets, and scene or
  Roman-numeral clip names.
- Explicit overwrite protection, automatic missing-scene creation, and one-step
  undo for the complete matrix.

### Changed

- Finished the generation dialog with custom dropdowns, toggles, and seed input.

## [0.1.2] - 2026-08-16

### Changed

- Redesigned the generation dialog around the matrix preview and primary action.

## [0.1.1] - 2026-08-16

### Changed

- Identified Serein Devices as the extension author in Live.

## [0.1.0] - 2026-08-16

### Added

- First public matrix generator with four scenes, five roles, deterministic
  controls, note preview, overwrite protection, and one-step undo.

[Unreleased]: https://github.com/alex-boulanger/serein-devices-isobare/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/alex-boulanger/serein-devices-isobare/compare/v0.1.2...v1.0.0
[0.1.2]: https://github.com/alex-boulanger/serein-devices-isobare/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/alex-boulanger/serein-devices-isobare/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/alex-boulanger/serein-devices-isobare/releases/tag/v0.1.0
