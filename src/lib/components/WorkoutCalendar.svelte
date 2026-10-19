<script lang="ts">
  import { tick } from 'svelte'
  import type { RoutineTemplate, WorkoutSession } from '$lib/types'
  import { buildWorkoutCalendar, buildWorkoutMonth, getAllTimeCalendarWeekCount, type WorkoutCalendarDay, type WorkoutCalendarRoutineMarker } from '$lib/workout-calendar'

  export let workouts: WorkoutSession[]
  export let routines: RoutineTemplate[]
  export let now: number

  type CalendarRange = 'month' | 'quarter' | 'year' | 'all'

  const rangeOptions: Array<{ id: CalendarRange; label: string; shortLabel: string }> = [
    { id: 'month', label: 'Month', shortLabel: 'Month' },
    { id: 'quarter', label: '3 months', shortLabel: '3M' },
    { id: 'year', label: '1 year', shortLabel: '1Y' },
    { id: 'all', label: 'All time', shortLabel: 'All' },
  ]

  const routineColors = [
    'var(--color-accent-soft)',
    'oklch(0.87 0.055 248)',
    'var(--color-success-soft)',
    'oklch(0.9 0.055 88)',
  ]

  let selectedRange: CalendarRange = 'month'
  let scrollRegion: HTMLDivElement
  $: calendarDay = new Date(now).toDateString()
  $: calendarTimestamp = new Date(calendarDay).getTime()
  $: allTimeWeekCount = getAllTimeCalendarWeekCount(workouts, calendarTimestamp)
  $: calendar = selectedRange === 'month'
    ? buildWorkoutMonth(workouts, calendarTimestamp)
    : buildWorkoutCalendar(
        workouts,
        calendarTimestamp,
        selectedRange === 'quarter' ? 13 : selectedRange === 'year' ? 52 : allTimeWeekCount,
      )
  $: calendarDays = calendar.weeks.flatMap((week) => week.days)
  $: routineLegend = buildRoutineLegend(calendarDays)
  $: periodLabel = selectedRange === 'month'
    ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(new Date(calendarTimestamp))
    : selectedRange === 'quarter'
      ? 'Past 13 weeks'
      : selectedRange === 'year'
        ? 'Past 52 weeks'
        : 'All recorded history'

  async function selectRange(range: CalendarRange) {
    selectedRange = range
    if (range !== 'all') return
    await tick()
    scrollRegion.scrollLeft = scrollRegion.scrollWidth
  }

  function stableHash(value: string) {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
    return Math.abs(hash)
  }

  function routineName(marker: WorkoutCalendarRoutineMarker) {
    if (!marker.routineId) return 'One-off'
    return routines.find((routine) => routine.id === marker.routineId)?.name ?? marker.fallbackName
  }

  function routineColor(marker: WorkoutCalendarRoutineMarker) {
    if (!marker.routineId) return 'var(--color-panel-deep)'
    const name = routineName(marker).toLowerCase()
    if (/\bpush\b/.test(name)) return routineColors[0]
    if (/\bpull\b/.test(name)) return routineColors[1]
    if (/\b(legs?|lower)\b/.test(name)) return routineColors[2]
    return routineColors[stableHash(marker.routineId) % routineColors.length]
  }

  function routineCode(marker: WorkoutCalendarRoutineMarker) {
    const name = routineName(marker).toLowerCase()
    if (!marker.routineId) return '1X'
    if (/\bpush\b/.test(name)) return 'PSH'
    if (/\bpull\b/.test(name)) return 'PLL'
    if (/\b(legs?|lower)\b/.test(name)) return 'LEG'
    return name.replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase()
  }

  function monthDayStyle(day: WorkoutCalendarDay) {
    const primary = day.routineMarkers[0] ? routineColor(day.routineMarkers[0]) : 'var(--color-canvas)'
    const secondary = day.routineMarkers[1] ? routineColor(day.routineMarkers[1]) : primary
    return `--day-primary:${primary};--day-secondary:${secondary}`
  }

  function buildRoutineLegend(days: WorkoutCalendarDay[]) {
    const markers = new Map<string, WorkoutCalendarRoutineMarker>()
    for (const day of days) {
      for (const marker of day.routineMarkers) {
        const key = marker.routineId ?? 'one-off'
        if (!markers.has(key)) markers.set(key, marker)
      }
    }
    return [...markers.entries()].map(([key, marker]) => ({ key, label: routineName(marker), color: routineColor(marker) }))
  }

  function dotTitle(day: WorkoutCalendarDay) {
    if (day.isOutsideRange) return day.dateLabel
    if (day.isFuture) return `${day.dateLabel}: upcoming`
    if (!day.trained) return `${day.dateLabel}: no training`
    const workoutLabel = day.workoutCount === 1 ? 'session' : 'sessions'
    const routinesForDay = day.routineMarkers.map(routineName).join(' and ')
    return `${day.dateLabel}: ${routinesForDay}; ${day.workoutCount} ${workoutLabel}`
  }
</script>

<section class="col-span-2 flex min-w-0 flex-col overflow-hidden rounded-2xl bg-paper p-5 sm:p-6 lg:col-span-7" aria-labelledby="workout-calendar-heading">
  <div class="flex items-start justify-between gap-5">
    <div><p class="font-dot text-xs text-accent">CONSISTENCY</p><h2 id="workout-calendar-heading" class="mt-1 text-xl font-medium">Training calendar</h2></div>
    <span class="font-dot shrink-0 text-3xl tabular-nums">{calendar.activeDays}</span>
  </div>
  <p class="mt-2 text-xs text-muted">{calendar.totalWorkouts} sessions across {calendar.activeDays} active days · {calendar.completedSets} completed sets</p>

  <nav class="mt-5 grid grid-cols-4 gap-1 rounded-xl bg-canvas p-1" aria-label="Calendar range">
    {#each rangeOptions as option (option.id)}
      <button
        class:bg-ink={selectedRange === option.id}
        class:text-paper={selectedRange === option.id}
        class="min-h-11 rounded-lg px-2 text-[0.6875rem] font-medium"
        aria-label={`Show ${option.label}`}
        aria-pressed={selectedRange === option.id}
        on:click={() => selectRange(option.id)}
      ><span class="sm:hidden">{option.shortLabel}</span><span class="hidden sm:inline">{option.label}</span></button>
    {/each}
  </nav>

  {#if selectedRange === 'month'}
    <div class="mt-5" role="img" aria-label={`${periodLabel} training days`}>
      <div class="month-weekdays mb-2 grid grid-cols-7 text-center text-[0.5625rem] uppercase text-muted" aria-hidden="true">
        <span>Su</span><span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span>
      </div>
      <div class="month-days grid grid-cols-7 gap-1">
        {#each calendarDays as day (day.date)}
          <span
            class:trained-day={day.trained}
            class:mixed-routines={day.routineMarkers.length > 1}
            class:outside-month={day.isOutsideRange}
            class:future-day={day.isFuture}
            class="month-day"
            style={day.trained ? monthDayStyle(day) : ''}
            title={dotTitle(day)}
          >
            <span class="day-number">{Number(day.date.slice(-2))}</span>
            {#if day.trained}<span class="routine-code">{day.routineMarkers.slice(0, 2).map(routineCode).join('/')}</span>{/if}
          </span>
        {/each}
      </div>
    </div>
  {:else}
    <div class:quarter={selectedRange === 'quarter'} class:year={selectedRange === 'year'} class:all={selectedRange === 'all'} class="week-chart mt-5 flex min-w-0 gap-2">
      <div class="weekday-labels shrink-0 text-[0.5625rem] uppercase text-muted" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
      <div
        bind:this={scrollRegion}
        class:calendar-scroll={selectedRange === 'all'}
        class:overflow-x-auto={selectedRange === 'all'}
        class="min-w-0 flex-1 pb-2"
        role="img"
        aria-label={`Training days from ${calendar.rangeStart} through ${calendar.rangeEnd}`}
      >
        <div class:quarter={selectedRange === 'quarter'} class:year={selectedRange === 'year'} class:all={selectedRange === 'all'} class="calendar-canvas" style={`--week-count:${calendar.weeks.length}`}>
          <div class="month-grid mb-2 text-[0.5625rem] uppercase text-muted" aria-hidden="true">
            {#each calendar.weeks as week}<span>{week.monthLabel}</span>{/each}
          </div>
          <div class="week-grid">
            {#each calendar.weeks as week}
              <div class="week-column">
                {#each week.days as day}
                  <span class:trained-day={day.trained} class:future-day={day.isFuture} class="day-dot" title={dotTitle(day)}></span>
                {/each}
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if selectedRange === 'month'}
    <div class="mt-auto border-t border-rule pt-4 text-[0.625rem] uppercase text-muted">
      <div class="flex items-center justify-between gap-4"><span>{periodLabel}</span><span>Routine key</span></div>
      {#if routineLegend.length > 0}
        <div class="legend-scroll mt-3 flex gap-4 overflow-x-auto pb-1">
          {#each routineLegend as item (item.key)}
            <span class="flex shrink-0 items-center gap-1.5"><span class="routine-key" style={`--routine-color:${item.color}`}></span>{item.label}</span>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="mt-auto flex items-center justify-between gap-4 border-t border-rule pt-4 text-[0.625rem] uppercase text-muted">
      <span>{periodLabel}</span>
      <span class="flex shrink-0 items-center gap-1.5"><span class="trained-key"></span> Trained</span>
    </div>
  {/if}
</section>

<style>
  .month-day { position: relative; display: flex; min-width: 0; aspect-ratio: 1; flex-direction: column; align-items: flex-start; justify-content: space-between; overflow: hidden; border-radius: 4px; padding: 0.35rem; background: var(--color-canvas); color: var(--color-ink); font-family: var(--font-display); font-size: 0.75rem; font-variation-settings: "ROND" 100, "wght" 700; }
  .month-day.trained-day { background: var(--day-primary); }
  .month-day.mixed-routines::after { position: absolute; inset: 0; background: var(--day-secondary); clip-path: polygon(100% 0, 100% 100%, 0 100%); content: ''; }
  .month-day > span { position: relative; z-index: 1; }
  .routine-code { align-self: flex-end; font-size: 0.4375rem; line-height: 1; letter-spacing: 0.03em; }
  .month-day.outside-month { visibility: hidden; }
  .month-day.future-day { color: var(--color-rule); background: transparent; }
  .calendar-canvas.quarter { width: 14rem; margin-left: auto; }
  .calendar-canvas.year { width: 100%; }
  .calendar-canvas.all { width: max-content; min-width: 100%; }
  .month-grid,
  .week-grid { display: grid; grid-template-columns: repeat(var(--week-count), minmax(0, 1fr)); gap: 0.1rem; }
  .calendar-canvas.quarter .month-grid,
  .calendar-canvas.quarter .week-grid { grid-template-columns: repeat(var(--week-count), 0.8rem); gap: 0.22rem; }
  .calendar-canvas.all .month-grid,
  .calendar-canvas.all .week-grid { grid-template-columns: repeat(var(--week-count), 0.56rem); gap: 0.18rem; }
  .month-grid > span { min-width: 0; white-space: nowrap; }
  .week-column { display: grid; grid-template-rows: repeat(7, auto); gap: 0.1rem; }
  .calendar-canvas.quarter .week-column { gap: 0.22rem; }
  .calendar-canvas.all .week-column { gap: 0.18rem; }
  .day-dot { display: block; width: 100%; aspect-ratio: 1; border-radius: 2px; background: var(--color-panel); }
  .day-dot.trained-day { background: var(--color-accent); }
  .day-dot.future-day { background: transparent; }
  .weekday-labels { display: grid; grid-template-rows: repeat(7, 1fr); }
  .week-chart.quarter .weekday-labels { height: 6.76rem; margin-top: 1.25rem; }
  .week-chart.year .weekday-labels { height: 3rem; margin-top: 1.25rem; }
  .week-chart.all .weekday-labels { height: 4.98rem; margin-top: 1.25rem; }
  .weekday-labels span:nth-child(1) { grid-row: 2; }
  .weekday-labels span:nth-child(2) { grid-row: 4; }
  .weekday-labels span:nth-child(3) { grid-row: 6; }
  .calendar-scroll,
  .legend-scroll { scrollbar-width: thin; scrollbar-color: var(--color-rule) transparent; }
  .trained-key,
  .routine-key { display: block; width: 0.6rem; height: 0.6rem; border-radius: 2px; }
  .trained-key { background: var(--color-accent); }
  .routine-key { background: var(--routine-color); }
</style>
