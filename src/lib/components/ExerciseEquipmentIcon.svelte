<script lang="ts">
  import {
    Activity,
    Cable as CableIcon,
    CircleDot,
    Disc3,
    Dumbbell,
    Frame,
    MoveHorizontal,
    PersonStanding,
    Settings2,
    Shapes,
    Spline,
    Weight,
  } from '@lucide/svelte'

  export let equipment: string
  export let muscle = ''
  export let className = 'size-5'
</script>

{#if muscle === 'Cardio'}
  <Activity class={className} aria-hidden="true" />
{:else if equipment === 'Barbell' || equipment === 'Dumbbells' || equipment === 'EZ Bar'}
  <Dumbbell class={className} aria-hidden="true" />
{:else if equipment === 'Cable'}
  <CableIcon class={className} aria-hidden="true" />
{:else if equipment === 'Machine'}
  <Settings2 class={className} aria-hidden="true" />
{:else if equipment === 'Bodyweight'}
  <PersonStanding class={className} aria-hidden="true" />
{:else if equipment === 'Kettlebell'}
  <Weight class={className} aria-hidden="true" />
{:else if equipment === 'Smith Machine' || equipment === 'Trap Bar'}
  <Frame class={className} aria-hidden="true" />
{:else if equipment === 'Resistance Band'}
  <MoveHorizontal class={className} aria-hidden="true" />
{:else if equipment === 'Suspension Trainer'}
  <Spline class={className} aria-hidden="true" />
{:else if equipment === 'Medicine Ball'}
  <CircleDot class={className} aria-hidden="true" />
{:else if equipment === 'Plate'}
  <Disc3 class={className} aria-hidden="true" />
{:else}
  <Shapes class={className} aria-hidden="true" />
{/if}
