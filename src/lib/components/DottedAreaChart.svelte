<script lang="ts">
  interface DottedChartPoint {
    label: string
    value: number
  }

  export let points: DottedChartPoint[]
  export let ariaLabel: string
  export let unit: string
  export let emptyLabel = 'No data in this range.'

  const columnCount = 32
  const rowCount = 12
  const plotLeft = 50
  const plotRight = 342
  const plotBottom = 146
  const rowGap = 10
  const axisFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

  function interpolate(index: number, values: DottedChartPoint[], sampleCount: number) {
    if (values.length === 0) return 0
    if (values.length === 1) return values[0].value
    const position = (index / (sampleCount - 1)) * (values.length - 1)
    const lowerIndex = Math.floor(position)
    const upperIndex = Math.min(values.length - 1, lowerIndex + 1)
    const progress = position - lowerIndex
    return values[lowerIndex].value + (values[upperIndex].value - values[lowerIndex].value) * progress
  }

  $: chartMax = Math.max(1, ...points.map((point) => point.value))
  $: sampleCount = points.length === 1 ? 3 : columnCount
  $: columns = Array.from({ length: sampleCount }, (_, index) => {
    const value = interpolate(index, points, sampleCount)
    const filledRows = value <= 0 ? 0 : Math.max(1, Math.round((value / chartMax) * rowCount))
    return {
      x: points.length === 1 ? 170 + index * 10 : plotLeft + (index / (sampleCount - 1)) * (plotRight - plotLeft),
      filledRows,
    }
  })
  $: description = points.map((point) => `${point.label}: ${point.value}`).join('; ')
</script>

{#if points.length === 0}
  <div class="grid h-52 place-items-center text-sm text-muted">{emptyLabel}</div>
{:else}
  <svg viewBox="0 0 360 180" class="h-52 w-full" role="img" aria-label={ariaLabel}>
    <desc>{description}</desc>
    <text x="42" y="39" text-anchor="end" fill="var(--color-muted)" font-size="9">{axisFormatter.format(chartMax)} {unit}</text>
    <text x="42" y="94" text-anchor="end" fill="var(--color-muted)" font-size="9">{axisFormatter.format(chartMax / 2)}</text>
    <text x="42" y="150" text-anchor="end" fill="var(--color-muted)" font-size="9">0</text>
    <line x1="46" y1="36" x2={plotLeft} y2="36" stroke="var(--color-rule)" stroke-width="1" />
    <line x1="46" y1="91" x2={plotLeft} y2="91" stroke="var(--color-rule)" stroke-width="1" />
    <line x1="46" y1={plotBottom} x2={plotLeft} y2={plotBottom} stroke="var(--color-rule)" stroke-width="1" />
    {#each columns as column}
      {#each Array(column.filledRows) as _, rowIndex}
        <circle cx={column.x} cy={plotBottom - rowIndex * rowGap} r="3" fill="var(--color-ink)" />
      {/each}
    {/each}
    {#if points.length === 1}
      <text x="180" y="171" text-anchor="middle" fill="var(--color-muted)" font-size="10">{points[0].label}</text>
    {:else}
      <text x={plotLeft} y="171" text-anchor="start" fill="var(--color-muted)" font-size="10">{points[0].label}</text>
      <text x={plotRight} y="171" text-anchor="end" fill="var(--color-muted)" font-size="10">{points.at(-1)?.label}</text>
    {/if}
  </svg>
{/if}
