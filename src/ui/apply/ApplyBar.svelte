<script lang="ts">
  import { countLabel } from "../shared/labels";
  import { useSession } from "../session/session.svelte";

  const session = useSession();
  const missingScenes = $derived(session.destination.missingSceneCount);
</script>

<footer>
  <div class="notices">
    {#if session.error}
      <p class="error" role="alert">{session.error}</p>
    {:else if session.generation.failure}
      <p class="error">{session.generation.failure}</p>
    {:else if missingScenes > 0}
      <p class="notice">
        {countLabel(missingScenes, "missing scene")} will be appended
      </p>
    {/if}

    {#if session.occupiedCount > 0}
      <label class="overwrite">
        <input type="checkbox" bind:checked={session.overwriteOccupied} />
        <span>overwrite {countLabel(session.occupiedCount, "occupied clip")}</span>
      </label>
    {/if}
  </div>

  <div class="actions">
    <button type="button" onclick={() => session.cancel()}>cancel</button>
    <button type="button" class="primary" onclick={() => session.apply()}>
      generate matrix
    </button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    min-height: 48px;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--line);
  }

  .notices {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 5px;
    font-size: var(--type-small);
  }

  .notice {
    color: var(--warn);
    font-size: var(--type-small);
  }

  .error {
    color: var(--error);
    font-size: var(--type-small);
  }

  .overwrite {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--warn);
    cursor: pointer;
  }

  .overwrite input {
    accent-color: var(--warn);
  }

  .actions {
    display: flex;
    flex-shrink: 0;
    gap: 7px;
  }

  .actions button {
    height: 26px;
    min-width: 84px;
    padding: 0 14px;
    border: 1px solid var(--line);
    background: transparent;
    letter-spacing: var(--track);
  }

  .actions button:hover {
    border-color: var(--ink);
  }

  /* Monochrome emphasis: the primary action inverts rather than colours. */
  .actions .primary {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--bg);
  }

  .actions .primary:hover {
    background: transparent;
    color: var(--ink);
  }
</style>
