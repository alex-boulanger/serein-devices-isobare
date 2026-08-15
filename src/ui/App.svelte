<script lang="ts">
  import {
    generate,
    MUSICAL_ROLES,
    ROLE_NAMES,
    SCENE_KINDS,
    SCENE_NAMES,
    type GenerationRecipe,
    type MusicalRole,
  } from "../generation/generate";
  import { closeModal, readDialogInput } from "./live-bridge";

  interface MutableLane {
    id: string;
    role: MusicalRole;
    octaveOffset: number;
    enabled: boolean;
  }

  const pitchClassNames = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const octaveOffsets = [-2, -1, 0, 1, 2];
  const input = readDialogInput();

  let lanes = $state<MutableLane[]>(input.recipe.lanes.map((lane) => ({ ...lane })));
  let motion = $state(input.recipe.parameters.motion);
  let tension = $state(input.recipe.parameters.tension);
  let space = $state(input.recipe.parameters.space);
  let seed = $state(input.recipe.seed);
  let overwriteOccupied = $state(false);
  let error = $state("");

  const recipe = $derived<GenerationRecipe>({
    engineVersion: 4,
    seed,
    parameters: {
      ...input.recipe.parameters,
      motion,
      tension,
      space,
    },
    lanes: lanes.map((lane) => ({ ...lane })),
  });
  const enabledCount = $derived(lanes.filter((lane) => lane.enabled).length);
  const preview = $derived(enabledCount > 0 ? generate(recipe) : undefined);
  const occupiedCount = $derived(lanes.reduce((total, lane) => {
    if (!lane.enabled) return total;
    return total + (destinationFor(lane.id)?.occupiedCount ?? 0);
  }, 0));

  function destinationFor(id: string) {
    return input.destination.lanes.find((lane) => lane.id === id);
  }

  function octaveLabel(offset: number): string {
    if (offset === 0) return "As generated";
    return `${offset > 0 ? "+" : ""}${offset} octave${Math.abs(offset) === 1 ? "" : "s"}`;
  }

  function identityLabel(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function cancel(): void {
    closeModal({ kind: "cancel" });
  }

  function apply(): void {
    error = "";
    if (enabledCount === 0) {
      error = "Include at least one track.";
      return;
    }
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffff_ffff) {
      error = "Seed must be an integer from 0 to 4,294,967,295.";
      return;
    }
    if (occupiedCount > 0 && !overwriteOccupied) {
      error = "Enable overwrite or cancel to preserve the occupied clips.";
      return;
    }
    closeModal({ kind: "apply", recipe, overwriteOccupied });
  }
</script>

<svelte:head>
  <meta name="color-scheme" content="light dark" />
</svelte:head>

<main>
  <header>
    <div>
      <h1>Ambient matrix</h1>
      <p>
        {pitchClassNames[input.recipe.parameters.rootPitchClass]}
        {input.recipe.parameters.scale.name} · 4 scenes · 8 bars
      </p>
    </div>
    <label class="seed-control">
      <span>Seed</span>
      <input type="number" min="0" max="4294967295" step="1" bind:value={seed} />
    </label>
  </header>

  <section class="macros" aria-label="Composition controls">
    <label>
      <span>Motion</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={motion} />
      <output>{Math.round(motion * 100)}</output>
    </label>
    <label>
      <span>Tension</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={tension} />
      <output>{Math.round(tension * 100)}</output>
    </label>
    <label>
      <span>Space</span>
      <input type="range" min="0" max="1" step="0.01" bind:value={space} />
      <output>{Math.round(space * 100)}</output>
    </label>
  </section>

  <section class="lanes" aria-labelledby="lanes-heading">
    <div class="section-heading">
      <h2 id="lanes-heading">Tracks</h2>
      <span>{enabledCount} of {lanes.length} included</span>
    </div>
    <div class="lane-table">
      <div class="lane-row lane-header" aria-hidden="true">
        <span></span><span>Live track</span><span>Role</span><span>Register</span><span>Existing</span>
      </div>
      {#each lanes as lane (lane.id)}
        <div class:disabled={!lane.enabled} class="lane-row">
          <input class="include" type="checkbox" bind:checked={lane.enabled} aria-label={`Include ${destinationFor(lane.id)?.trackName ?? "track"}`} />
          <strong>{destinationFor(lane.id)?.trackName ?? lane.id}</strong>
          <select bind:value={lane.role} disabled={!lane.enabled} aria-label="Musical role">
            {#each MUSICAL_ROLES as role}
              <option value={role}>{ROLE_NAMES[role]}</option>
            {/each}
          </select>
          <select bind:value={lane.octaveOffset} disabled={!lane.enabled} aria-label="Octave offset">
            {#each octaveOffsets as offset}
              <option value={offset}>{octaveLabel(offset)}</option>
            {/each}
          </select>
          <span class:occupied={(destinationFor(lane.id)?.occupiedCount ?? 0) > 0}>
            {destinationFor(lane.id)?.occupiedCount ?? 0}
          </span>
        </div>
      {/each}
    </div>
  </section>

  <section class="preview" aria-labelledby="preview-heading">
    <div class="section-heading">
      <h2 id="preview-heading">Generated clips</h2>
      <span>note count per 8-bar clip</span>
    </div>
    <div class="matrix">
      <div class="matrix-row matrix-header">
        <span>Role lane</span>
        {#each SCENE_KINDS as kind}<span>{SCENE_NAMES[kind]}</span>{/each}
      </div>
      {#if preview}
        {#each preview.lanes as lane}
          <div class="matrix-row">
            <strong>
              {ROLE_NAMES[lane.role]}{lane.roleInstance > 0 ? ` ${lane.roleInstance + 1}` : ""}
              · {identityLabel(lane.identity.articulationFamily ?? lane.identity.name)}
            </strong>
            {#each lane.scenes as scene}<span>{scene.metrics.noteCount}</span>{/each}
          </div>
        {/each}
      {/if}
    </div>
  </section>

  <div class="messages">
    {#if input.destination.missingSceneCount > 0}
      <p class="notice">
        {input.destination.missingSceneCount} missing Live
        {input.destination.missingSceneCount === 1 ? " scene" : " scenes"} will be appended.
      </p>
    {/if}
    {#if occupiedCount > 0}
      <label class="overwrite">
        <input type="checkbox" bind:checked={overwriteOccupied} />
        <span>Overwrite {occupiedCount} occupied {occupiedCount === 1 ? "clip" : "clips"}</span>
      </label>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>

  <footer>
    <button class="secondary" type="button" onclick={cancel}>Cancel</button>
    <button class="primary" type="button" onclick={apply}>Generate matrix</button>
  </footer>
</main>

<style>
  :global(*) { box-sizing: border-box; }
  :global(:root) {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    color-scheme: light dark;
    --bg: #303033; --panel: #39393c; --control: #444447; --line: #555559;
    --text: #ededed; --muted: #b6b6ba; --accent: #8ab4d6; --accent-text: #17212a;
    --warning: #e0b56a; --error: #ff9a8f;
  }
  @media (prefers-color-scheme: light) {
    :global(:root) {
      --bg: #d7d7d7; --panel: #e2e2e2; --control: #f1f1f1; --line: #aaa;
      --text: #202020; --muted: #616161; --accent: #76a6c9; --accent-text: #10202b;
      --warning: #76520f; --error: #a62a20;
    }
  }
  :global(body) { margin: 0; min-width: 680px; background: var(--bg); color: var(--text); }
  main { min-height: 100vh; padding: 18px 20px; }
  header, footer, .section-heading { display: flex; align-items: center; justify-content: space-between; }
  header { padding-bottom: 14px; border-bottom: 1px solid var(--line); }
  h1, h2, p { margin: 0; }
  h1 { font-size: 17px; font-weight: 600; }
  h2 { font-size: 12px; font-weight: 600; }
  header p, .section-heading span { margin-top: 4px; color: var(--muted); font-size: 11px; }
  label span, output { color: var(--muted); font-size: 12px; }
  input, select, button {
    height: 27px; border: 1px solid #202024; border-radius: 2px;
    background: var(--control); color: var(--text); font: inherit; font-size: 12px;
  }
  input:focus, select:focus { outline: 1px solid var(--accent); outline-offset: -1px; }
  .seed-control { display: flex; align-items: center; gap: 8px; }
  .seed-control input { width: 118px; padding: 3px 6px; }
  .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px; padding: 14px 0; }
  .macros label { display: grid; grid-template-columns: 52px 1fr 28px; align-items: center; gap: 7px; }
  input[type="range"] { height: 18px; padding: 0; accent-color: var(--accent); }
  output { text-align: right; font-variant-numeric: tabular-nums; }
  .lanes, .preview { margin-top: 7px; }
  .section-heading { margin-bottom: 6px; }
  .lane-table, .matrix { border: 1px solid var(--line); background: var(--panel); }
  .lane-row { display: grid; grid-template-columns: 28px minmax(110px, 1fr) 130px 130px 50px; align-items: center; gap: 7px; min-height: 35px; padding: 3px 8px; border-top: 1px solid var(--line); }
  .lane-row:first-child { border-top: 0; }
  .lane-row strong, .matrix-row strong { overflow: hidden; font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
  .lane-row > span:last-child { text-align: center; color: var(--muted); font-size: 12px; }
  .lane-row > span.occupied { color: var(--warning); }
  .lane-header { min-height: 24px; color: var(--muted); font-size: 10px; }
  .disabled { opacity: .45; }
  .include, .overwrite input { width: 14px; height: 14px; accent-color: var(--accent); }
  select { width: 100%; padding: 2px 5px; }
  .preview { margin-top: 14px; }
  .matrix-row { display: grid; grid-template-columns: minmax(115px, 1fr) repeat(4, 1fr); min-height: 25px; align-items: center; border-top: 1px solid var(--line); }
  .matrix-row:first-child { border-top: 0; }
  .matrix-row > * { padding: 4px 8px; border-left: 1px solid var(--line); font-size: 11px; }
  .matrix-row > *:first-child { border-left: 0; }
  .matrix-row span { text-align: center; color: var(--muted); }
  .matrix-header { min-height: 23px; }
  .matrix-header span { font-size: 10px; }
  .messages { min-height: 34px; padding-top: 10px; }
  .notice, .error { font-size: 12px; }
  .notice { color: var(--warning); }
  .error { margin-top: 7px; color: var(--error); }
  .overwrite { display: flex; align-items: center; gap: 7px; }
  .overwrite span { color: var(--text); }
  footer { gap: 8px; justify-content: flex-end; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
  button { min-width: 92px; padding: 3px 11px; cursor: pointer; }
  .primary { border-color: var(--accent); background: var(--accent); color: var(--accent-text); }
</style>
