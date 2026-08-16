<script lang="ts">
  import {
    barLines,
    noteRects,
    octaveLines,
    type PitchRange,
    type PlotBox,
    type PlotSeries,
    type VelocityRange,
  } from "./note-plot";

  let {
    series,
    range,
    box,
    velocities,
    durationBeats,
  }: {
    series: readonly PlotSeries[];
    range: PitchRange;
    box: PlotBox;
    velocities: VelocityRange;
    durationBeats: number;
  } = $props();
</script>

<svg
  viewBox="0 0 {box.width} {box.height}"
  preserveAspectRatio="none"
  aria-hidden="true"
>
  <g class="octaves">
    {#each octaveLines(range, box) as y (y)}
      <line x1="0" x2={box.width} y1={y} y2={y} vector-effect="non-scaling-stroke" />
    {/each}
  </g>

  <g class="bars">
    {#each barLines(durationBeats, box) as x (x)}
      <line x1={x} x2={x} y1="0" y2={box.height} vector-effect="non-scaling-stroke" />
    {/each}
  </g>

  {#each series as lane (lane.id)}
    <g
      class="notes"
      class:dimmed={lane.dimmed}
      style="--note-ink: var(--role-{lane.role})"
    >
      {#each noteRects(lane.notes, range, durationBeats, box, velocities) as note, index (index)}
        <rect
          x={note.x}
          y={note.y}
          width={note.width}
          height={note.height}
          opacity={note.opacity}
        />
      {/each}
    </g>
  {/each}
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Quiet enough that a sustained note is never mistaken for a rule. */
  .octaves line,
  .bars line {
    shape-rendering: crispEdges;
  }

  .octaves line {
    stroke: var(--line-soft);
    stroke-width: 1;
    opacity: 0.65;
  }

  .bars line {
    stroke: var(--line-soft);
    stroke-width: 1;
    stroke-dasharray: 1 3;
  }

  /*
   * A 44-semitone range in a 52px cell leaves 1.2px per semitone, so notes a
   * step apart necessarily overlap and fuse into one thick bar. The seam is
   * what separates them; making the notes thinner would just make them vanish.
   */
  .notes rect {
    fill: var(--note-ink, var(--ink));
    stroke: var(--sunken);
    stroke-width: 1;
    paint-order: stroke;
    vector-effect: non-scaling-stroke;
  }

  .notes {
    transition: opacity 120ms ease-out;
  }

  .dimmed {
    opacity: 0.2;
  }
</style>
