<script lang="ts">
  export let value: number | null
  export let disabled = false
  export let onChange: (value: number | null) => void

  const levels = Array.from({ length: 10 }, (_, index) => index + 1)
  const pointFor = (level: number) => ({
    x: 14 + ((level - 1) / 9) * 292,
    y: 76 - Math.pow((level - 1) / 9, 1.55) * 58,
  })
  const curvePoints = levels.map((level) => {
    const point = pointFor(level)
    return `${point.x},${point.y}`
  }).join(' ')
  const areaPoints = `14,82 ${curvePoints} 306,82`
</script>

<div class="rpe-curve" role="group" aria-label="Rate perceived exertion from 1 to 10">
  <div class="flex items-center justify-between px-1">
    <span class="text-xs font-medium uppercase text-muted">Effort curve</span>
    <span class="font-dot text-lg text-accent">{value ?? '—'}<span class="font-sans text-xs text-muted"> / 10</span></span>
  </div>
  <div class="relative mt-2 h-28 px-2">
    <svg class="absolute inset-0 h-full w-full" viewBox="0 0 320 92" aria-hidden="true" preserveAspectRatio="none">
      <polygon points={areaPoints} fill="var(--color-accent-soft)" />
      <polyline points={curvePoints} fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    {#each levels as level}
      {@const point = pointFor(level)}
      <button
        type="button"
        class:active={value === level}
        class="rpe-point"
        style={`left:${(point.x / 320) * 100}%;top:${(point.y / 92) * 100}%`}
        disabled={disabled}
        aria-label={`RPE ${level}`}
        aria-pressed={value === level}
        on:click={() => onChange(value === level ? null : level)}
      >{level}</button>
    {/each}
  </div>
  <div class="flex justify-between px-1 text-[0.6875rem] text-muted"><span>Easy</span><span>Maximum effort</span></div>
</div>

<style>
  .rpe-curve { border-radius: 0.75rem; background: var(--color-canvas); padding: 0.75rem; }
  .rpe-point { position: absolute; display: grid; width: 1.875rem; height: 1.875rem; place-items: center; transform: translate(-50%, -50%); border-radius: 9999px; background: var(--color-paper); color: var(--color-muted); font-size: 0.6875rem; font-weight: 600; transition: transform 150ms cubic-bezier(0.25, 1, 0.5, 1), background-color 150ms, color 150ms; }
  .rpe-point::after { position: absolute; inset: -0.35rem; content: ''; }
  .rpe-point.active { transform: translate(-50%, -50%) scale(1.14); background: var(--color-ink); color: var(--color-paper); }
  .rpe-point:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }
  .rpe-point:disabled { cursor: default; opacity: 0.55; }
</style>
