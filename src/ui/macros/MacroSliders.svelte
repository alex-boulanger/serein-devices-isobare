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
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 12px 0;
  }

  /* min-width: 0 on both the cell and the range input, or the input's intrinsic
     width refuses to shrink and the fourth macro overflows the modal. */
  label {
    display: grid;
    min-width: 0;
    grid-template-columns: 40px 1fr 18px;
    align-items: center;
    gap: 6px;
  }

  label input {
    min-width: 0;
  }

  output {
    text-align: right;
  }
</style>
