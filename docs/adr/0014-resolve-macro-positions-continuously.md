# Resolve macro positions continuously

Motion, Tension, and Space are continuous controls, but nearly everything they
drive is a count of events or voices. Rounding those counts against fixed
thresholds turned each slider into a three-position switch: every Motion value
between 0.34 and 0.66 produced identical density, and the full sweep moved the
note count by only 20%. Counts are now resolved by deterministic stochastic
rounding — the fractional part becomes the chance that one particular lane,
Scene, or contour rounds up, drawn from a hash of the seed and a stable label.

## Consequences

- An identical recipe still scores identically, so ADR 0009 holds: the coin is a
  hash of seed and label, never a draw from a random source.
- The hash needs a real avalanche step. FNV-1a alone leaves the high bits
  correlated across the short, similar labels the engine uses, which biases
  every rounded count low and makes the sliders track under their setting.
- Ranges have to be wide enough to hear. Resolving continuously across a narrow
  range is still inaudible, so the role and Scene budgets were widened with it.
