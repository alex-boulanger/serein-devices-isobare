# Plan complete Harmonic Paths before rendering notes

The engine generates and scores complete Harmonic Paths—including loop closure and Transition Anchor compatibility—before rendering asynchronous note events. We rejected permanently committing to a sequence of locally attractive mutations because greedy generation cannot reliably coordinate eight-bar loops, transformations across the Scene Arc, and compatible transitions between independently launched scenes.

## Consequences

Generation uses deterministic bounded search over whole-path candidates. Foundation supplies canonical material; Development, Tension, and Release are constrained transformations of that material rather than independent generations.
