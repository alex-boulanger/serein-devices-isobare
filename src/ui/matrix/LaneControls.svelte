<script lang="ts">
  import {
    MUSICAL_ROLES,
    ROLE_NAMES,
    ROLE_STYLE_NAMES,
    type MusicalRole,
    type RoleStyle,
  } from "../../generation/generate";
  import CustomSelect from "../shared/controls/CustomSelect.svelte";
  import Toggle from "../shared/controls/Toggle.svelte";
  import type { SelectOption } from "../shared/controls/control-model";
  import { octaveLabel, octaveTitle } from "../shared/labels";
  import { stylesFor, useSession, type LaneDraft } from "../session/session.svelte";

  let { lane }: { lane: LaneDraft } = $props();

  const session = useSession();
  const octaveOffsets = [-2, -1, 0, 1, 2];
  const styles = $derived(stylesFor(lane.role));
  const occupied = $derived(session.occupiedFor(lane.id));
  const roleOptions: readonly SelectOption[] = MUSICAL_ROLES.map((role) => ({
    value: role,
    label: ROLE_NAMES[role],
  }));
  const styleOptions = $derived<readonly SelectOption[]>(
    styles.map((style) => ({ value: style, label: ROLE_STYLE_NAMES[style] })),
  );
  const octaveOptions: readonly SelectOption[] = octaveOffsets.map((offset) => ({
    value: offset,
    label: octaveLabel(offset),
  }));
</script>

<div class="lane" class:excluded={!lane.enabled}>
  <div class="identity">
    <Toggle
      checked={lane.enabled}
      label={`Include ${session.trackName(lane.id)}`}
      onValueChange={(checked) => (lane.enabled = checked)}
    />
    <span class="track">{session.trackName(lane.id)}</span>
    {#if occupied > 0}
      <span class="occupied numeric" title={`${occupied} occupied clips`}>{occupied}</span>
    {/if}
  </div>

  <div class="assignment" class:styled={styles.length > 0}>
    <CustomSelect
      value={lane.role}
      options={roleOptions}
      disabled={!lane.enabled}
      label="Musical role"
      onValueChange={(value) => session.setRole(lane, value as MusicalRole)}
    />

    {#if styles.length > 0}
      <CustomSelect
        value={lane.style ?? styles[0]!}
        options={styleOptions}
        disabled={!lane.enabled}
        label="Role style"
        onValueChange={(value) => (lane.style = value as RoleStyle)}
      />
    {/if}

    <CustomSelect
      value={lane.octaveOffset}
      options={octaveOptions}
      disabled={!lane.enabled}
      label="Octave offset"
      title={octaveTitle(lane.octaveOffset)}
      align="center"
      onValueChange={(value) => (lane.octaveOffset = value as number)}
    />
  </div>
</div>

<style>
  .lane {
    display: flex;
    flex-direction: column;
    gap: 3px;
    justify-content: center;
    padding: 2px 10px;
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
    font-weight: 600;
  }

  .occupied {
    padding: 1px 5px;
    border: 1px solid var(--warn);
    border-radius: 2px;
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

  .excluded .identity .track,
  .excluded .assignment {
    opacity: 0.4;
  }
</style>
