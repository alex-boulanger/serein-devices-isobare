# Sample the Composition Plan rather than optimise it

Every part of the plan that could have varied with the seed was instead being
optimised to a single answer. `createInitialVoicing` took the argmax of a
scoring function whose optimum is sharp, so across two hundred seeds it produced
**four** Foundation voicings; the Pitch Hierarchy produced five anchor sets, and
the Melodic Motif drew its rhythm from a table of eight. Since every Scene
departs from the Foundation voicing, and Bass and Drone play anchors and nothing
else, the whole product had a harmonic vocabulary of fifty voicings. Generations
sounded correct and interchangeable.

The plan is now sampled instead: the Foundation voicing is drawn from the
candidates scoring near the best, the second anchor may be a fourth or sixth
rather than always the fifth, motif rhythms are accumulated from seeded gaps,
and Bass articulation families are described by a gap character rather than a
fixed array of beats.

## Considered options

Widening the score jitter was the obvious alternative and is wrong. Measured, it
barely worked — forty times the original jitter still yielded only 25 distinct
voicings of 200 — and what it does buy is bought by adding noise to a musical
judgement rather than by choosing differently among good answers.

## Consequences

- Diversity is taken from harmonic colour, register and spacing, never from how
  well a voicing answers Tension. That deviation is held to a narrow band around
  the best available, because sampling on it measurably blunts the macro: the
  first attempt cost Tension a quarter of its grip. Splitting the score this way
  ended up sharper than the original argmax.
- Determinism is untouched. A recipe still scores identically every time; the
  seed now selects among good candidates instead of being almost ignored.
- Statistical tests calibrated against the old, near-degenerate distribution
  needed recalibrating against measured values at large sample size. A test that
  passed on four possible plans says little about eighty-five.
- Transition Anchor gravity was raised from 0.45 to 1.2, which the narrow plan
  could not afford. More harmonic room means the anchor pull no longer competes
  with the Motion movement target.
