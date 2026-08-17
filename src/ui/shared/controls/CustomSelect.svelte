<script lang="ts" module>
  let nextSelectId = 0;
</script>

<script lang="ts">
  import {
    moveOptionIndex,
    selectedOptionIndex,
    type ControlValue,
    type SelectOption,
  } from "./control-model";

  let {
    value,
    options,
    label,
    disabled = false,
    title,
    align = "left",
    onValueChange,
  }: {
    value: ControlValue;
    options: readonly SelectOption[];
    label: string;
    disabled?: boolean;
    title?: string;
    align?: "left" | "center";
    onValueChange: (value: ControlValue) => void;
  } = $props();

  const listboxId = `custom-select-${nextSelectId++}`;
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let open = $state(false);
  let openAbove = $state(false);
  let activeIndex = $state(0);

  const selected = $derived(
    options.find((option) => option.value === value) ?? options[0],
  );

  function openList(initialIndex = selectedOptionIndex(options, value)): void {
    if (disabled || options.length === 0) return;
    activeIndex = initialIndex;
    const triggerBox = trigger.getBoundingClientRect();
    const estimatedHeight = Math.min(options.length * 25 + 8, 158);
    openAbove = triggerBox.bottom + estimatedHeight > window.innerHeight - 12;
    open = true;
  }

  function closeList(): void {
    open = false;
  }

  function choose(index: number): void {
    const option = options[index];
    if (option === undefined) return;
    onValueChange(option.value);
    closeList();
    trigger.focus();
  }

  function handleTriggerClick(): void {
    if (open) closeList();
    else openList();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (disabled) return;

    if (!open) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const selectedIndex = selectedOptionIndex(options, value);
        openList(
          moveOptionIndex(options.length, selectedIndex, event.key === "ArrowDown" ? 1 : -1),
        );
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = moveOptionIndex(
        options.length,
        activeIndex,
        event.key === "ArrowDown" ? 1 : -1,
      );
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      activeIndex = event.key === "Home" ? 0 : Math.max(0, options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeList();
    } else if (event.key === "Tab") {
      closeList();
    }
  }

  function handleWindowClick(event: MouseEvent): void {
    if (open && !root.contains(event.target as Node)) closeList();
  }
</script>

<svelte:window onclick={handleWindowClick} onblur={closeList} />

<div class="select" class:open class:above={openAbove} class:center={align === "center"} bind:this={root}>
  <button
    bind:this={trigger}
    type="button"
    class="trigger"
    role="combobox"
    aria-label={label}
    aria-controls={listboxId}
    aria-expanded={open}
    aria-haspopup="listbox"
    aria-activedescendant={open ? `${listboxId}-${activeIndex}` : undefined}
    {disabled}
    {title}
    onclick={handleTriggerClick}
    onkeydown={handleKeydown}
  >
    <span class="value">{selected?.label ?? "—"}</span>
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  </button>

  {#if open}
    <div id={listboxId} class="listbox" role="listbox" aria-label={label}>
      {#each options as option, index (`${option.value}`)}
        <button
          id={`${listboxId}-${index}`}
          type="button"
          role="option"
          aria-selected={option.value === value}
          class:active={index === activeIndex}
          onmouseenter={() => (activeIndex = index)}
          onclick={() => choose(index)}
          tabindex="-1"
        >
          <span>{option.label}</span>
          {#if option.value === value}
            <svg class="check" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m3.5 8.2 2.8 2.8 6.2-6.2" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .select {
    position: relative;
    min-width: 0;
  }

  .trigger {
    display: flex;
    width: 100%;
    height: 21px;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    padding: 0 5px 0 7px;
    border: 1px solid var(--line);
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.32);
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-size: var(--type-small);
    text-align: left;
  }

  .trigger:hover:not(:disabled),
  .open .trigger {
    border-color: var(--blue);
  }

  .trigger:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .value {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .trigger svg {
    width: 12px;
    height: 12px;
    flex: 0 0 auto;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
    transition: transform 120ms ease-out;
  }

  .open .trigger > svg {
    transform: rotate(180deg);
  }

  .listbox {
    position: absolute;
    z-index: 20;
    top: calc(100% + 3px);
    left: 0;
    min-width: 100%;
    max-height: 158px;
    overflow-y: auto;
    padding: 3px;
    border: 1px solid var(--line-strong);
    border-radius: 4px;
    background: var(--cream-raised);
    box-shadow: 0 8px 20px rgba(26, 23, 20, 0.18), 0 2px 5px rgba(26, 23, 20, 0.12);
  }

  .above .listbox {
    top: auto;
    bottom: calc(100% + 3px);
  }

  .listbox button {
    display: flex;
    width: 100%;
    height: 24px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 0 6px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-size: var(--type-small);
    text-align: left;
    white-space: nowrap;
  }

  .listbox button.active {
    background: var(--blue);
    color: #fff;
  }

  .check {
    width: 12px;
    height: 12px;
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.7;
  }

  .center .trigger,
  .center .listbox button {
    text-align: center;
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger svg {
      transition-duration: 0.01ms;
    }
  }
</style>
