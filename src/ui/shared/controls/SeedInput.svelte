<script lang="ts">
  import { MAX_RANDOM_SEED } from "../../../application/random-seed";
  import { parseSeedDraft } from "./control-model";

  let {
    value,
    label = "Seed",
    onValueChange,
    onRandomize,
  }: {
    value: number;
    label?: string;
    onValueChange: (value: number) => void;
    onRandomize: () => void;
  } = $props();

  let editing = $state(false);
  let draft = $state("");

  const invalid = $derived.by(() => {
    const parsed = parseSeedDraft(draft);
    return !Number.isInteger(parsed) || parsed < 0 || parsed > MAX_RANDOM_SEED;
  });

  $effect.pre(() => {
    if (!editing && Number.isFinite(value)) draft = String(value);
  });

  function handleInput(event: Event): void {
    draft = event.currentTarget instanceof HTMLInputElement
      ? event.currentTarget.value.replace(/[^0-9]/g, "")
      : draft;
  }

  function commit(): void {
    editing = false;
    onValueChange(parseSeedDraft(draft));
  }

  function step(delta: number): void {
    const parsed = parseSeedDraft(draft);
    const base = Number.isInteger(parsed) ? parsed : Number.isFinite(value) ? value : 0;
    const next = Math.min(MAX_RANDOM_SEED, Math.max(0, base + delta));
    draft = String(next);
    onValueChange(next);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      (event.currentTarget as HTMLInputElement).blur();
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    }
  }
</script>

<div class="seed">
  <label for="seed-value" class="meta">{label}</label>
  <div class="field" class:invalid>
    <input
      id="seed-value"
      class="numeric"
      type="text"
      inputmode="numeric"
      autocomplete="off"
      spellcheck="false"
      aria-invalid={invalid}
      aria-describedby={invalid ? "seed-hint" : undefined}
      value={draft}
      onfocus={() => (editing = true)}
      oninput={handleInput}
      onblur={commit}
      onkeydown={handleKeydown}
    />
    <button type="button" aria-label="Randomize seed" title="Randomize seed" onclick={onRandomize}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M15.7 7.3A6 6 0 1 0 16 11" />
        <path d="M12.8 3.6h3.4V7" />
      </svg>
    </button>
  </div>
  {#if invalid}
    <span id="seed-hint" class="visually-hidden">
      Enter a whole number from 0 to {MAX_RANDOM_SEED}.
    </span>
  {/if}
</div>

<style>
  .seed {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  label {
    margin-right: 2px;
    font-weight: 600;
  }

  .field {
    display: flex;
    height: 26px;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    background: var(--control);
  }

  .field:focus-within {
    outline: 2px solid var(--blue);
    outline-offset: 2px;
  }

  .field.invalid {
    border-color: var(--error);
  }

  input {
    width: 108px;
    min-width: 0;
    padding: 0 7px;
    border: 0;
    outline: 0;
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-size: var(--type-small);
    text-align: right;
  }

  button {
    display: grid;
    width: 25px;
    height: 24px;
    place-items: center;
    padding: 0;
    border: 0;
    border-left: 1px solid var(--line);
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
  }

  button:hover {
    color: var(--blue);
  }

  button:focus-visible {
    outline-offset: -3px;
  }

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
