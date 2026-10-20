<script lang="ts">
  import { RPE_OPTIONS } from '$lib/rpe'

  export let value: number | null
  export let disabled = false
  export let onChange: (value: number | null) => void

  const defaultIndex = RPE_OPTIONS.findIndex((option) => option.value === 8)

  $: valueIndex = RPE_OPTIONS.findIndex((option) => option.value === value)
  $: sliderIndex = valueIndex >= 0 ? valueIndex : defaultIndex
  $: selectedOption = valueIndex >= 0 ? RPE_OPTIONS[valueIndex] : null
  $: sliderProgress = (sliderIndex / (RPE_OPTIONS.length - 1)) * 100

  function choose(event: Event) {
    const index = Number((event.currentTarget as HTMLInputElement).value)
    onChange(RPE_OPTIONS[index]?.value ?? null)
  }
</script>

<div class="rpe-picker" role="group" aria-label="Rate perceived exertion from 6 to 10">
  <div class="rpe-summary">
    <div class="min-w-0">
      <span class="text-[0.6875rem] font-medium uppercase text-muted">Effort</span>
      <span class="mt-1 block text-sm font-medium">{selectedOption?.label ?? 'Choose your effort'}</span>
      <span class="mt-0.5 block min-h-4 text-[0.6875rem] leading-4 text-muted">{selectedOption?.description ?? 'Move the slider to rate this set.'}</span>
    </div>
    {#if selectedOption}
      <button type="button" class="clear-action" disabled={disabled} on:click={() => onChange(null)}>Clear</button>
    {/if}
  </div>

  <div class="slider-row">
  <div class:unset={selectedOption === null} class="slider-shell">
    <span class="slider-label" aria-hidden="true">RPE</span>
    <div class="slider-track">
      <div class:max-fill={sliderIndex === RPE_OPTIONS.length - 1} class="track-fill-rail" aria-hidden="true">
        <span class="track-fill" style={`width:${sliderProgress}%`}></span>
      </div>
      <div class="dot-rail" aria-hidden="true">
        {#each RPE_OPTIONS as _option}<span class="dot"></span>{/each}
      </div>
      <input
        class="rpe-slider"
        type="range"
        min="0"
        max={RPE_OPTIONS.length - 1}
        step="1"
        value={sliderIndex}
        disabled={disabled}
        aria-label="RPE"
        aria-valuetext={selectedOption ? `RPE ${selectedOption.value}: ${selectedOption.label}. ${selectedOption.description}` : 'No RPE selected'}
        on:input={choose}
      />
    </div>
  </div>
    <output class="rpe-reading" aria-live="polite">{selectedOption?.value ?? '—'}</output>
  </div>
  <span class="sr-only">RPE ranges from 6, with four or more repetitions remaining, to 10, with no repetitions remaining.</span>
</div>

<style>
  .rpe-picker { border-radius: 0.75rem; background: var(--color-canvas); padding: 0.75rem; }
  .rpe-summary { display: grid; min-height: 3.25rem; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 1rem; padding-inline: 0.25rem; }
  .clear-action { min-height: 2.75rem; flex: 0 0 auto; padding-inline: 0.5rem; color: var(--color-muted); font-size: 0.625rem; font-weight: 600; text-transform: uppercase; }
  .clear-action:hover { color: var(--color-ink); }
  .slider-row { display: grid; grid-template-columns: minmax(0, 1fr) 3.25rem; align-items: center; gap: 0.65rem; margin-top: 0.75rem; }
  .slider-shell { display: grid; grid-template-columns: minmax(4.5rem, 22%) minmax(0, 1fr); height: 4.25rem; overflow: hidden; border-radius: 1rem; background: var(--color-paper); }
  .slider-label { position: relative; z-index: 2; display: flex; align-items: center; background: var(--color-panel); padding-inline: 1rem; color: var(--color-muted); font-size: 1rem; font-weight: 600; letter-spacing: 0.02em; }
  .slider-track { position: relative; min-width: 0; background: color-mix(in srgb, var(--color-panel) 30%, var(--color-paper)); --track-edge-space: 0.65rem; --handle-edge-space: var(--track-edge-space); }
  .track-fill-rail { position: absolute; inset: 0 var(--handle-edge-space); pointer-events: none; }
  .track-fill-rail::before, .track-fill-rail.max-fill::after { position: absolute; top: 0; bottom: 0; width: var(--handle-edge-space); background: var(--color-panel); content: ''; }
  .track-fill-rail::before { right: 100%; }
  .track-fill-rail.max-fill::after { left: 100%; }
  .track-fill { position: relative; display: block; height: 100%; background: var(--color-panel); }
  .track-fill::after { position: absolute; left: 100%; top: 0; bottom: 0; width: 1.125rem; border-radius: 0 1rem 1rem 0; background: var(--color-panel); content: ''; }
  .dot-rail { position: absolute; inset: 0 var(--track-edge-space); display: flex; align-items: center; justify-content: space-between; pointer-events: none; }
  .dot { position: relative; z-index: 1; width: 0.25rem; height: 0.25rem; border-radius: 999px; background: var(--color-muted); opacity: 0.72; }
  .slider-shell.unset .dot { opacity: 0.55; }
  .rpe-reading { display: grid; min-width: 0; place-items: center; color: var(--color-accent); font-family: var(--font-display); font-size: 2rem; line-height: 1; font-variant-numeric: tabular-nums; font-variation-settings: "ROND" 100, "wght" 700; }
  .rpe-slider { position: absolute; inset: 0 var(--handle-edge-space); z-index: 3; width: auto; height: 100%; margin: 0; cursor: ew-resize; appearance: none; background: transparent; }
  .rpe-slider:focus { outline: none; }
  .rpe-slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--color-accent) 20%, transparent); }
  .rpe-slider:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--color-accent) 20%, transparent); }
  .rpe-slider:disabled { cursor: default; opacity: 0.5; }
  .rpe-slider::-webkit-slider-runnable-track { height: 100%; background: transparent; }
  .rpe-slider::-webkit-slider-thumb { width: 0.25rem; height: 2.5rem; margin-top: 0.875rem; border: 0; border-radius: 999px; appearance: none; background: var(--color-accent); }
  .rpe-slider::-moz-range-track { height: 100%; background: transparent; }
  .rpe-slider::-moz-range-thumb { width: 0.25rem; height: 2.5rem; border: 0; border-radius: 999px; background: var(--color-accent); }
  @media (min-width: 640px) {
    .rpe-picker { padding: 0.9rem; }
    .slider-shell { grid-template-columns: 6rem minmax(0, 1fr); }
    .slider-label { padding-inline: 1.25rem; }
  }
</style>
