<script lang="ts">
  import {
    ROLE_NAMES,
    ROLE_STYLE_NAMES,
    SCENE_KINDS,
    sceneLabel,
    type GeneratedLane,
    type SceneKind,
  } from "../../generation/generate";
  import { pitchName } from "../shared/labels";
  import { useSession } from "../session/session.svelte";
  import LaneControls from "./LaneControls.svelte";
  import NotePlot from "./NotePlot.svelte";
  import {
    LANE_PLOT_BOX,
    STACK_PLOT_BOX,
    pitchRangeOf,
    velocityRangeOf,
    type PlotSeries,
  } from "./note-plot";

  const session = useSession();

  let focusedScene = $state<SceneKind | undefined>(undefined);
  let hoveredLaneId = $state<string | undefined>(undefined);

  const generated = $derived(session.generation.result?.lanes ?? []);
  const range = $derived(pitchRangeOf(generated));
  const velocities = $derived(velocityRangeOf(generated));
  const durationBeats = $derived(generated[0]?.scenes[0]?.durationBeats ?? 32);

  const sceneTotals = $derived(
    SCENE_KINDS.map((_, index) =>
      generated.reduce(
        (total, lane) => total + (lane.scenes[index]?.notes.length ?? 0),
        0,
      ),
    ),
  );

  function generatedFor(id: string): GeneratedLane | undefined {
    return generated.find((lane) => lane.id === id);
  }

  function seriesFor(id: string, sceneIndex: number): PlotSeries[] {
    const notes = generatedFor(id)?.scenes[sceneIndex]?.notes ?? [];
    return [{ id, role: generatedFor(id)?.role ?? "pad", notes, dimmed: isDimmed(id) }];
  }

  function stackSeries(sceneIndex: number): PlotSeries[] {
    return session.lanes
      .filter((lane) => lane.enabled)
      .map((lane) => ({
        id: lane.id,
        role: lane.role,
        notes: generatedFor(lane.id)?.scenes[sceneIndex]?.notes ?? [],
        dimmed: isDimmed(lane.id),
      }));
  }

  function isDimmed(id: string): boolean {
    return hoveredLaneId !== undefined && hoveredLaneId !== id;
  }

  function toggleScene(kind: SceneKind): void {
    focusedScene = focusedScene === kind ? undefined : kind;
  }

  /** One readout line: the shared axis by default, the hovered lane on demand. */
  const readout = $derived.by(() => {
    const lane = hoveredLaneId === undefined ? undefined : generatedFor(hoveredLaneId);
    if (lane === undefined) {
      const total = session.generation.result?.metrics.noteCount ?? 0;
      return `${pitchName(range.low)}–${pitchName(range.high)} · ${total} notes · shared pitch axis`;
    }

    const parts = [
      ROLE_NAMES[lane.role] + (lane.roleInstance > 0 ? ` ${lane.roleInstance + 1}` : ""),
      ...(lane.style ? [ROLE_STYLE_NAMES[lane.style]] : []),
      ...(lane.identity.articulationFamily ? [lane.identity.articulationFamily] : []),
      lane.identity.name,
      `${lane.scenes.reduce((total, scene) => total + scene.notes.length, 0)} notes`,
    ];
    return parts.join(" · ");
  });
</script>

<section class="matrix-slice" aria-label="destination matrix">
  <div class="matrix" class:focused={focusedScene !== undefined}>
    <div class="corner">
      <span class="corner-title">Arrangement</span>
      <span class="meta">{session.enabledCount}/{session.lanes.length} tracks</span>
    </div>

    {#each SCENE_KINDS as kind, index (kind)}
      <button
        type="button"
        class="scene-head"
        class:active={focusedScene === kind}
        class:muted={focusedScene !== undefined && focusedScene !== kind}
        aria-pressed={focusedScene === kind}
        title={focusedScene === kind ? "back to the scene arc" : `stack ${sceneLabel(kind, session.sceneLabelStyle)}`}
        onclick={() => toggleScene(kind)}
      >
        <span class:numeral={session.sceneLabelStyle === "numeral"}>
          {sceneLabel(kind, session.sceneLabelStyle)}
        </span>
        <span class="meta numeric">{sceneTotals[index] ?? 0}</span>
      </button>
    {/each}

    {#each session.lanes as lane (lane.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="controls-cell"
        onmouseenter={() => (hoveredLaneId = lane.id)}
        onmouseleave={() => (hoveredLaneId = undefined)}
        onfocusin={() => (hoveredLaneId = lane.id)}
        onfocusout={() => (hoveredLaneId = undefined)}
      >
        <LaneControls {lane} />
      </div>

      {#if focusedScene === undefined}
        {#each SCENE_KINDS as kind, index (kind)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <div
            class="cell"
            class:excluded={!lane.enabled}
            onmouseenter={() => (hoveredLaneId = lane.id)}
            onmouseleave={() => (hoveredLaneId = undefined)}
          >
            {#if lane.enabled}
              <NotePlot
                series={seriesFor(lane.id, index)}
                {range}
                box={LANE_PLOT_BOX}
                {velocities}
                {durationBeats}
              />
            {/if}
          </div>
        {/each}
      {/if}
    {/each}

    {#if focusedScene !== undefined}
      <div class="stack-cell" style="grid-row: 2 / span {session.lanes.length};">
        <NotePlot
          series={stackSeries(SCENE_KINDS.indexOf(focusedScene))}
          {range}
          box={STACK_PLOT_BOX}
          {velocities}
          {durationBeats}
        />
      </div>
    {/if}
  </div>

  <p class="readout meta">{readout}</p>
</section>

<style>
  .matrix-slice {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .matrix {
    display: grid;
    min-height: 0;
    flex: 1;
    grid-auto-rows: minmax(var(--row-min), 1fr);
    grid-template-columns: var(--control-column) repeat(4, 1fr);
    grid-template-rows: auto;
    border-top: 1px solid var(--line-strong);
    border-bottom: 1px solid var(--line-strong);
    background: var(--panel);
  }

  .corner {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 8px 10px;
  }

  .corner-title {
    font-weight: 650;
  }

  .scene-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 7px 9px;
    border: 0;
    border-left: 1px solid var(--line-strong);
    background: transparent;
    letter-spacing: var(--track);
  }

  .scene-head:hover {
    background: rgba(255, 255, 255, 0.35);
    color: var(--blue);
  }

  .scene-head.active {
    background: var(--blue);
    color: #fff;
  }

  .scene-head.active .meta {
    color: #fff;
  }

  .scene-head.muted {
    opacity: 0.45;
  }

  /* Lowercase roman numerals mean minor chords to a musician, so these keep
     their case even though the rest of the chrome is lowercase. */
  .numeral {
    text-transform: none;
  }

  .controls-cell {
    grid-column: 1;
    border-top: 1px solid var(--line);
  }

  /* Lane rows need a firm separator: sparse notes cluster near the boundary
     and would otherwise read as one continuous field. */
  .cell,
  .stack-cell {
    overflow: hidden;
    border-top: 1px solid var(--line);
    border-left: 1px solid var(--line);
    background: var(--sunken);
  }

  .stack-cell {
    grid-column: 2 / -1;
  }

  .cell.excluded {
    background: repeating-linear-gradient(
      135deg,
      transparent 0 5px,
      var(--line-soft) 5px 6px
    );
    opacity: 0.3;
  }

  .readout {
    padding-top: 8px;
    text-transform: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
