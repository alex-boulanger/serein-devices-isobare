<script lang="ts">
  import {
    ROLE_NAMES,
    SCENE_LABEL_STYLES,
    SCENE_LABEL_STYLE_NAMES,
    sceneLabel,
  } from "../../generation/generate";
  import { pitchClassName } from "../shared/labels";
  import { useSession } from "../session/session.svelte";

  const session = useSession();
  const key = $derived(
    `${pitchClassName(session.parameters.rootPitchClass)} ${session.parameters.scale.name}`,
  );
  const noteCount = $derived(session.generation.result?.metrics.noteCount ?? 0);
</script>

<header>
  <div class="title-block">
    <p class="eyebrow">Serein devices</p>
    <h1>Isobare</h1>
    <p class="meta numeric">
      {key} <span>·</span> 4 scenes <span>·</span> 8 bars <span>·</span> {noteCount} notes
    </p>
  </div>

  <div class="controls">
    <div class="labels" role="group" aria-label="clip name style">
      <span class="meta control-label">Clip names</span>
      {#each SCENE_LABEL_STYLES as style (style)}
        <button
          type="button"
          class:active={session.sceneLabelStyle === style}
          aria-pressed={session.sceneLabelStyle === style}
          title={`${ROLE_NAMES.bass} — ${sceneLabel("foundation", style)}`}
          onclick={() => (session.sceneLabelStyle = style)}
        >
          <span class:numeral={style === "numeral"}>
            {SCENE_LABEL_STYLE_NAMES[style]}
          </span>
        </button>
      {/each}
    </div>

    <label class="seed">
      <span class="meta control-label">Seed</span>
      <input
        class="numeric"
        type="number"
        min="0"
        max="4294967295"
        step="1"
        bind:value={session.seed}
      />
      <button type="button" aria-label="Randomize seed" title="Randomize seed" onclick={() => session.randomizeSeed()}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M15.7 7.3A6 6 0 1 0 16 11" />
          <path d="M12.8 3.6h3.4V7" />
        </svg>
      </button>
    </label>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 15px;
    border-bottom: 1px solid var(--line-strong);
  }

  h1 {
    margin: 1px 0 3px;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.045em;
    line-height: 0.95;
  }

  .eyebrow {
    color: var(--blue);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .title-block .meta span {
    padding: 0 2px;
    color: var(--line-strong);
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 20px;
    padding-top: 3px;
  }

  .labels,
  .seed {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .control-label {
    margin-right: 2px;
    font-weight: 600;
  }

  .labels button {
    height: 26px;
    padding: 0 9px;
    border: 1px solid var(--line-strong);
    background: transparent;
  }

  .labels button:hover {
    border-color: var(--blue);
    color: var(--blue);
  }

  /* Roman numerals keep their case; lowercased they read as minor chords. */
  .numeral {
    text-transform: none;
  }

  .labels button.active {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--cream);
  }

  .seed input {
    width: 108px;
    text-align: right;
  }

  .seed button {
    display: grid;
    width: 26px;
    height: 26px;
    place-items: center;
    padding: 0;
    border: 1px solid var(--line-strong);
    background: transparent;
  }

  .seed button:hover {
    border-color: var(--blue);
    color: var(--blue);
  }

  .seed svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }
</style>
