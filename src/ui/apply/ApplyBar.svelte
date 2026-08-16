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
      <span>Generate matrix</span>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 10h11" />
        <path d="m11 6 4 4-4 4" />
      </svg>
    </button>
  </div>
</footer>

<style>
  footer {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    min-height: 64px;
    padding: 12px var(--pad);
    margin: 10px calc(var(--pad) * -1) 0;
    border-top: 1px solid var(--line-strong);
    background: var(--cream-raised);
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
    height: 34px;
    min-width: 84px;
    padding: 0 16px;
    border: 1px solid var(--line-strong);
    border-radius: 3px;
    background: transparent;
    font-weight: 600;
  }

  .actions button:hover {
    border-color: var(--blue);
    color: var(--blue);
  }

  .actions .primary {
    display: flex;
    min-width: 148px;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    border-color: var(--blue);
    background: var(--blue);
    color: #fff;
  }

  .actions .primary:hover {
    border-color: var(--ink);
    background: var(--ink);
    color: #fff;
  }

  .primary svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
  }
</style>
