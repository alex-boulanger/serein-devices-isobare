# Ambient Session Generation

The product creates a coordinated palette of looping MIDI material for performing ambient music in Ableton Live's Session View.

## Language

**Ambient Session**:
A matrix of related Scene rows and Musical Role columns that together form one performable musical world.
_Avoid_: Live set, song, collection of clips

**Prepared Template**:
An existing Ableton Live set whose user-owned MIDI tracks, instruments, and devices are destinations for generated Role Parts.
_Avoid_: Generated Live set, extension-managed instruments

**Composition Plan**:
The shared musical identity from which every Role Part in an Ambient Session is derived, including its harmonic material, anchors, motifs, and energy relationships.
_Avoid_: Global preset, shared seed

**Harmonic Path**:
A small sequence of related harmonic states connected by constrained voice movement without requiring chord labels or functional cadences.
_Avoid_: Chord progression, chord loop

**Transition Anchor**:
Pitch-class material toward which the opening and closing region of every Scene gravitates so that scenes can transition compatibly without sharing an identical boundary voicing.
_Avoid_: Transition chord, fixed turnaround

**Pitch Hierarchy**:
The ordered importance of the project scale's root, anchor degrees, color degrees, and deliberately rare degrees within one Composition Plan.
_Avoid_: Scale membership, random note weights

**Orchestration**:
The coordinated allocation of registers, anchor tones, density, and permitted doubling across Musical Roles before individual Role Parts are rendered.
_Avoid_: Instrumentation, independent role settings

**Downbeat Owner**:
The one included Role Lane permitted to sound on the first beat of a Scene Cycle, being the most structural role present. Ownership is permission rather than obligation: the owner may still keep a role-specific entrance shape, and the remaining lanes enter behind it.
_Avoid_: Leading lane, rhythmic leader, first lane

**Scene**:
A row of coordinated clips expressing one energy state; it is an independently loopable performance state, not a fixed section in a linear arrangement.
_Avoid_: Song section, stage, row

**Scene Cycle**:
The common loop duration of a Scene, eight bars by default, within which Role Parts may evolve at different rates.
_Avoid_: Universal pattern length, clip length

**Scene Arc**:
The default ordered energy profile Foundation, Development, Tension, and Release. The order suggests a performance journey but each Scene remains independently loopable.
_Avoid_: Song form, chord progression

**Musical Role**:
A distinct function performed by one column of clips within an Ambient Session. The roles are Bass, Pad, Drone, Arp Source, Lead, and Arp Line.
_Avoid_: Clip type, instrument type

**Role Part**:
The MIDI material through which one Musical Role expresses a particular Scene while remaining derived from the shared Composition Plan.
_Avoid_: Random clip, stem

**Sparse Role Part**:
A nonempty Role Part that uses few notes or mutations. The Ambient Session normally establishes material at launch through its combined structural roles, but an individual Role Part may use a deliberate entrance rest.
_Avoid_: Silent clip, incomplete clip

**Articulation Motif**:
The reusable onset, duration, and rest identity of a Role Variant, independent of its pitches. It remains recognizable while the Scene Arc transforms its spacing and phrasing.
_Avoid_: Pattern, harmonic rhythm, pitch sequence

**Melodic Motif**:
A short pitch-contour identity planned for an Ambient Session and transformed across its Scene Arc. It supplies recognizable melodic material without prescribing instrument timbre.
_Avoid_: Riff, random melody, fixed phrase

**Scene Profile**:
The coordinated transformation of harmony, register, density, articulation, and Foreground Allocation that makes one Scene a distinct performance state.
_Avoid_: Density preset, section automation, mood label

**Role Style**:
An explicit generation contract within a Musical Role, such as Sustained or Articulated Bass and Pluck or Flow Lead. It changes how one Role Part is authored without changing its harmonic responsibility or identifying a duplicate lane.
_Avoid_: Role Variant, instrument preset, timbre

**Role Lane**:
An included MIDI track assigned a Musical Role for one Ambient Session generation. Its identity remains stable across the Scene Arc so the artist can learn its performance contribution.
_Avoid_: Instrument type, role track

**Role Variant**:
One of several alternative harmonic realizations assigned the same Musical Role. A Role Variant fulfills that role alone and remains compatible when occasionally layered with its siblings.
_Avoid_: Duplicate role, doubled part, extra instrument

**Role Family**:
All Role Variants assigned the same Musical Role within an Ambient Session. Normal density assumes one active variant per Role Family rather than every variant sounding simultaneously.
_Avoid_: Track group, duplicate lanes

**Destination Matrix**:
The rectangular Session View region beginning at the selected upper-left clip slot and spanning the included Role Lanes across the four rows of the Scene Arc.
_Avoid_: Selection, output area

**Mix Resilience**:
The property that removing a Musical Role leaves coherent, intentionally sparse material rather than breaking the shared harmony. It does not require every Role Part to sound complete in isolation.
_Avoid_: Solo completeness, maximum density

**Orchestral Identity**:
The stable register, harmonic responsibility, movement tendency, and density character that distinguishes one Role Variant from its siblings across the Scene Arc.
_Avoid_: Instrument preset, timbre, random variation

**Arp Source**:
A Role Part containing sustained pitch material intended to be articulated by Ableton Live's Arpeggiator device.
_Avoid_: Arp, generated arpeggio

**Lead**:
A foreground, monophonic Role Part that transforms the Ambient Session's Melodic Motif according to the Scene Arc. Being foreground, its density follows its own Scene activity rather than the Role Family budget that keeps the harmony from crowding.
_Avoid_: Melody, solo, top line

**Arp Line**:
A composition-aware Role Part whose individual notes, rests, accents, gates, octave displacements, and optional events are authored by the extension.
_Avoid_: Arp Source, device arpeggio, step sequence

**Foreground Allocation**:
The Scene-specific assignment of melodic attention between Lead and Arp Line so their combined activity remains intentional rather than competitive.
_Avoid_: Solo track, volume priority, simultaneous maximum activity
