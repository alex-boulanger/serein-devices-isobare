# Changelog

Notes for people using Isobare. Each entry becomes the body of the matching
[GitHub Release](https://github.com/alex-boulanger/serein-devices-isobare/releases)
and is rendered on the Serein Devices site, so write for artists rather than for
the repository.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-16

First public release. Isobare generates a coordinated matrix of looping MIDI
material for performing ambient music in Ableton Live's Session View.

### Added

- **Ambient Matrix generation.** Right-click a Session View clip slot and choose
  _Generate…_ to fill up to eight consecutive MIDI tracks across
  four Scene rows — Foundation, Development, Tension and Release — from a single
  shared composition plan. The whole matrix is written in one undo step.
- **Five Musical Roles.** Bass, Pad, Drone, Arp Source and Lead, each with its
  own register, density and phrasing behaviour. Bass can be Articulated or
  Sustained; Lead can be Pluck or Flow.
- **Three performance macros.** Motion sets how much the material moves, Tension
  runs from consonant to abrasive, and Space from compact to open.
- **Seed control.** Every dialog opens on a fresh seed, and an identical recipe
  always produces identical MIDI. Randomise to explore, keep the number to
  return to a result exactly.
- **Live preview.** The dialog draws every generated note on one shared pitch
  axis, so you can read register, entrances and density across the whole matrix
  before committing. Click a Scene heading to stack that Scene's lanes together.
- **Overwrite protection.** Occupied clips are counted up front and preserved
  unless you explicitly consent to replacing them. Missing Scene rows are
  appended for you.
- **Your instruments, untouched.** Isobare writes MIDI only. It never inspects
  or changes your tracks, devices or mix — the sound stays yours.

### Notes

- Set Live's Global Quantization to **8 Bars** before using the extension. Every
  generated clip is exactly 8 bars, so Scene launches then land on cycle
  boundaries and the matrix stays in sync.
- Set Live's Global Scale before before using the extension. Isobare reads Live's project scale, with Scale Mode off, Isobare uses C major.

[Unreleased]: https://github.com/alex-boulanger/serein-devices-isobare/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/alex-boulanger/serein-devices-isobare/releases/tag/v0.1.0
