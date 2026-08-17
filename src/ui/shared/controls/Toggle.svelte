<script lang="ts">
  let {
    checked,
    label,
    text,
    disabled = false,
    tone = "default",
    onValueChange,
  }: {
    checked: boolean;
    label: string;
    text?: string;
    disabled?: boolean;
    tone?: "default" | "warning";
    onValueChange: (checked: boolean) => void;
  } = $props();
</script>

<button
  type="button"
  class:checked
  class:warning={tone === "warning"}
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  onclick={() => onValueChange(!checked)}
>
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  {#if text}<span class="label">{text}</span>{/if}
</button>

<style>
  button {
    --toggle-accent: var(--blue);
    display: inline-flex;
    min-width: 26px;
    height: 20px;
    flex: 0 0 auto;
    align-items: center;
    gap: 7px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-size: var(--type-small);
  }

  button.warning {
    --toggle-accent: var(--warn);
    color: var(--warn);
  }

  .track {
    position: relative;
    width: 26px;
    height: 14px;
    flex: 0 0 auto;
    border: 1px solid var(--line-strong);
    border-radius: 7px;
    background: transparent;
    transition: background-color 120ms ease-out, border-color 120ms ease-out;
  }

  button.checked .track {
    border-color: var(--toggle-accent);
    background: var(--toggle-accent);
  }

  .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: currentColor;
    transition: transform 120ms ease-out, background-color 120ms ease-out;
  }

  .checked .thumb {
    background: #fff;
    transform: translateX(12px);
  }

  button:disabled {
    cursor: default;
    opacity: 0.4;
  }

  .label {
    white-space: nowrap;
  }

  @media (prefers-reduced-motion: reduce) {
    .track,
    .thumb {
      transition-duration: 0.01ms;
    }
  }
</style>
