<script lang="ts">
  export let value: number
  export let ariaLabel: string
  export let tone: 'default' | 'danger' = 'default'
  export let startLabel = '0'
  export let midpointLabel = '50'
  export let endLabel = '100'
  export let ariaValueText: string | undefined = undefined

  const segments = Array.from({ length: 20 }, (_, index) => index)

  $: normalizedValue = Math.min(100, Math.max(0, value))
  $: activeSegments = Math.round((normalizedValue / 100) * segments.length)
</script>

<div class="segmented-progress">
  <div class="scale-labels" aria-hidden="true">
    <span>{startLabel}</span>
    <span>{midpointLabel}</span>
    <span>{endLabel}</span>
  </div>
  <div
    class="segments"
    role="progressbar"
    aria-label={ariaLabel}
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={normalizedValue}
    aria-valuetext={ariaValueText}
  >
    {#each segments as index}
      <span class:active={index < activeSegments} class:danger={tone === 'danger'} class="segment" aria-hidden="true"></span>
    {/each}
  </div>
</div>

<style>
  .segmented-progress { width: 100%; }
  .scale-labels { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 0.375rem; color: var(--color-muted); font-size: 0.5625rem; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; }
  .scale-labels span:nth-child(2) { text-align: center; }
  .scale-labels span:last-child { text-align: right; }
  .segments { display: grid; height: 1.75rem; grid-template-columns: repeat(20, minmax(0, 1fr)); gap: 0.125rem; }
  .segment { min-width: 0; border-radius: 9999px; background: var(--color-canvas); }
  .segment.active { background: var(--color-ink); }
  .segment.active.danger { background: var(--color-danger); }

  @media (min-width: 640px) {
    .segments { height: 2rem; gap: 0.1875rem; }
  }
</style>
