<script lang="ts">
  import {
    MUSICAL_ROLES,
    ROLE_NAMES,
    ROLE_STYLE_NAMES,
    type MusicalRole,
  } from "../../generation/generate";
  import { octaveLabel, octaveTitle } from "../shared/labels";
  import { stylesFor, useSession, type LaneDraft } from "../session/session.svelte";

  let { lane }: { lane: LaneDraft } = $props();

  const session = useSession();
  const octaveOffsets = [-2, -1, 0, 1, 2];
  const styles = $derived(stylesFor(lane.role));
  const occupied = $derived(session.occupiedFor(lane.id));
</script>

<div class="lane" class:excluded={!lane.enabled}>
  <div class="identity">
    <input
      type="checkbox"
      bind:checked={lane.enabled}
      aria-label={`include ${session.trackName(lane.id)}`}
    />
    <span class="track">{session.trackName(lane.id)}</span>
    {#if occupied > 0}
      <span class="occupied numeric" title={`${occupied} occupied clips`}>{occupied}</span>
    {/if}
  </div>

  <div class="assignment" class:styled={styles.length > 0}>
    <select
      value={lane.role}
      disabled={!lane.enabled}
      aria-label="musical role"
      onchange={(event) =>
        session.setRole(lane, event.currentTarget.value as MusicalRole)}
    >
      {#each MUSICAL_ROLES as role (role)}
        <option value={role}>{ROLE_NAMES[role]}</option>
      {/each}
    </select>

    {#if styles.length > 0}
      <select bind:value={lane.style} disabled={!lane.enabled} aria-label="role style">
        {#each styles as style (style)}
          <option value={style}>{ROLE_STYLE_NAMES[style]}</option>
        {/each}
      </select>
    {/if}

    <select
      bind:value={lane.octaveOffset}
      disabled={!lane.enabled}
      aria-label="octave offset"
      title={octaveTitle(lane.octaveOffset)}
      class="numeric"
    >
      {#each octaveOffsets as offset (offset)}
        <option value={offset}>{octaveLabel(offset)}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .lane {
    display: flex;
    flex-direction: column;
    gap: 5px;
    justify-content: center;
    padding: 6px 10px 6px 0;
  }

  .identity {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .track {
    overflow: hidden;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: none;
  }

  .occupied {
    padding: 0 4px;
    border: 1px solid var(--warn);
    color: var(--warn);
    font-size: var(--type-small);
  }

  .assignment {
    display: grid;
    grid-template-columns: 1fr 46px;
    gap: 5px;
  }

  .assignment.styled {
    grid-template-columns: 1fr 1fr 46px;
  }

  select {
    min-width: 0;
  }

  .assignment .numeric {
    text-align: center;
  }

  .excluded .identity .track,
  .excluded .assignment {
    opacity: 0.4;
  }
</style>
