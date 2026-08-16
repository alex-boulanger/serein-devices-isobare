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
  <div>
    <h1>isobare</h1>
    <p class="meta numeric">
      {key} · 4 scenes · 8 bars · {noteCount} notes
    </p>
  </div>

  <div class="controls">
    <div class="labels" role="group" aria-label="clip name style">
      <span class="meta">clips</span>
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
      <span class="meta">seed</span>
      <input
        class="numeric"
        type="number"
        min="0"
        max="4294967295"
        step="1"
        bind:value={session.seed}
      />
      <button type="button" title="randomize seed" onclick={() => session.randomizeSeed()}>
        ↻
      </button>
    </label>
  </div>
</header>

<style>
  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--line);
  }

  h1 {
    letter-spacing: 0.16em;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .labels,
  .seed {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .labels button {
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--line);
    background: var(--control);
    letter-spacing: var(--track);
  }

  .labels button:hover {
    border-color: var(--ink);
  }

  /* Roman numerals keep their case; lowercased they read as minor chords. */
  .numeral {
    text-transform: none;
  }

  .labels button.active {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }

  .seed input {
    width: 104px;
    text-align: right;
  }

  .seed button {
    width: 22px;
    height: 22px;
    padding: 0;
    border: 1px solid var(--line);
    background: var(--control);
    font-size: var(--type);
    line-height: 1;
  }

  .seed button:hover {
    border-color: var(--ink);
  }
</style>
