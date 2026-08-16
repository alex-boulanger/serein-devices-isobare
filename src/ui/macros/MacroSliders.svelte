<script lang="ts">
  import { useSession } from "../session/session.svelte";

  const session = useSession();
  const macros = [
    { key: "motion", label: "motion" },
    { key: "tension", label: "tension" },
    { key: "space", label: "space" },
    { key: "drift", label: "drift" },
  ] as const;
</script>

<section aria-label="composition controls">
  <div class="section-heading">
    <h2>Shape the composition</h2>
    <p class="meta">Drag to reshape the entire matrix</p>
  </div>
  {#each macros as macro (macro.key)}
    <label>
      <span class="meta">{macro.label}</span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        bind:value={session.macros[macro.key]}
      />
      <output class="meta numeric">{Math.round(session.macros[macro.key] * 100)}</output>
    </label>
  {/each}
</section>

<style>
  section {
    display: grid;
    grid-template-columns: 1.35fr repeat(4, 1fr);
    gap: 18px;
    padding: 15px 0 16px;
  }

  .section-heading {
    align-self: center;
  }

  h2 {
    margin-bottom: 2px;
    font-size: 13px;
    font-weight: 650;
    letter-spacing: -0.01em;
  }

  /* min-width: 0 on both the cell and the range input, or the input's intrinsic
     width refuses to shrink and the fourth macro overflows the modal. */
  label {
    display: grid;
    min-width: 0;
    grid-template-columns: 1fr 22px;
    grid-template-rows: auto auto;
    align-items: center;
    gap: 5px 7px;
  }

  label input {
    grid-column: 1 / -1;
    grid-row: 2;
    min-width: 0;
  }

  output {
    color: var(--ink);
    font-weight: 600;
    text-align: right;
  }
</style>
