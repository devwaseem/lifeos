<script lang="ts">
  import { Clock3, Gauge, Repeat2, Route, Weight } from '@lucide/svelte'
  import type { ExerciseTrackingMode } from '$lib/exercise-tracking'

  export let trackingMode: ExerciseTrackingMode = 'strength'
</script>

<div class={`set-grid ${trackingMode} px-1 pb-1 text-center text-[0.6875rem] uppercase text-muted`} aria-hidden="true">
  <span>Set</span>
  {#if trackingMode === 'strength'}
    <span class="set-heading"><Weight class="size-3.5" />kg</span>
    <span class="set-heading"><Repeat2 class="size-3.5" />Reps</span>
    <span class="set-heading"><Gauge class="size-3.5" />RPE</span>
  {:else}
    <span class="set-heading"><Clock3 class="size-3.5" />Duration</span>
    {#if trackingMode === 'distance-duration'}<span class="set-heading"><Route class="size-3.5" />Distance</span>{/if}
  {/if}
</div>

<style>
  .set-grid { display: grid; align-items: center; gap: 0.25rem; }
  .set-grid.strength { grid-template-columns: 1.5rem repeat(3, minmax(2.75rem, 1fr)); }
  .set-grid.duration { grid-template-columns: 1.5rem minmax(5rem, 1fr); }
  .set-grid.distance-duration { grid-template-columns: 1.5rem repeat(2, minmax(4.5rem, 1fr)); }
  .set-heading { display: inline-flex; align-items: center; justify-content: center; gap: 0.2rem; }
  @media (min-width: 640px) {
    .set-grid { gap: 0.5rem; }
    .set-grid.strength { grid-template-columns: 2.5rem repeat(3, minmax(4rem, 1fr)); }
    .set-grid.duration { grid-template-columns: 2.5rem minmax(6rem, 1fr); }
    .set-grid.distance-duration { grid-template-columns: 2.5rem repeat(2, minmax(6rem, 1fr)); }
  }
</style>
