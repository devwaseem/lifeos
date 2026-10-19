import type { WorkoutSession } from '$lib/types'

export interface WorkoutCalendarRoutineMarker {
  routineId: string | null
  fallbackName: string
}

export interface WorkoutCalendarDay {
  date: string
  dateLabel: string
  workoutCount: number
  completedSets: number
  trained: boolean
  routineMarkers: WorkoutCalendarRoutineMarker[]
  isFuture: boolean
  isOutsideRange: boolean
}

export interface WorkoutCalendarWeek {
  monthLabel: string
  days: WorkoutCalendarDay[]
}

export interface WorkoutCalendar {
  weeks: WorkoutCalendarWeek[]
  totalWorkouts: number
  activeDays: number
  completedSets: number
  rangeStart: string
  rangeEnd: string
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

function localDateKey(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(value: Date, days: number) {
  const next = new Date(value)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(value: Date) {
  return addDays(startOfLocalDay(value), -value.getDay())
}

function completedWorkoutDate(workout: WorkoutSession) {
  if (workout.status !== 'completed') return null
  const timestamp = new Date(workout.completedAt ?? workout.startedAt)
  return Number.isFinite(timestamp.getTime()) ? startOfLocalDay(timestamp) : null
}

function buildCalendarRange(
  workouts: WorkoutSession[],
  today: Date,
  firstGridDay: Date,
  weekCount: number,
  rangeStart: Date,
  rangeEnd: Date,
): WorkoutCalendar {
  const safeWeekCount = Math.max(1, Math.round(weekCount))
  const lastGridDay = addDays(firstGridDay, safeWeekCount * 7 - 1)
  const firstGridKey = localDateKey(firstGridDay)
  const lastGridKey = localDateKey(lastGridDay)
  const rangeStartKey = localDateKey(rangeStart)
  const rangeEndKey = localDateKey(rangeEnd)
  const activity = new Map<string, { workoutCount: number; completedSets: number; routineMarkers: Map<string, WorkoutCalendarRoutineMarker> }>()

  for (const workout of workouts) {
    const timestamp = completedWorkoutDate(workout)
    if (!timestamp) continue
    const key = localDateKey(timestamp)
    if (key < firstGridKey || key > lastGridKey) continue
    const current = activity.get(key) ?? { workoutCount: 0, completedSets: 0, routineMarkers: new Map() }
    current.workoutCount += 1
    current.completedSets += workout.exercises.reduce(
      (total, exercise) => total + exercise.sets.filter((set) => set.completed).length,
      0,
    )
    const routineKey = workout.routineId ?? 'one-off'
    if (!current.routineMarkers.has(routineKey)) {
      current.routineMarkers.set(routineKey, { routineId: workout.routineId, fallbackName: workout.routineId ? workout.title : 'One-off' })
    }
    activity.set(key, current)
  }

  let totalWorkouts = 0
  let activeDays = 0
  let completedSets = 0
  const monthFormatter = new Intl.DateTimeFormat('en', { month: 'short' })
  const dayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const weeks = Array.from({ length: safeWeekCount }, (_, weekIndex): WorkoutCalendarWeek => {
    const days = Array.from({ length: 7 }, (_, dayIndex): WorkoutCalendarDay => {
      const date = addDays(firstGridDay, weekIndex * 7 + dayIndex)
      const key = localDateKey(date)
      const isFuture = date.getTime() > today.getTime()
      const isOutsideRange = key < rangeStartKey || key > rangeEndKey
      const activityForDay = isFuture || isOutsideRange ? undefined : activity.get(key)
      const workoutCount = activityForDay?.workoutCount ?? 0
      const setsForDay = activityForDay?.completedSets ?? 0
      if (!isFuture && !isOutsideRange) {
        totalWorkouts += workoutCount
        completedSets += setsForDay
        if (workoutCount > 0) activeDays += 1
      }
      return {
        date: key,
        dateLabel: dayFormatter.format(date),
        workoutCount,
        completedSets: setsForDay,
        trained: workoutCount > 0,
        routineMarkers: activityForDay ? [...activityForDay.routineMarkers.values()] : [],
        isFuture,
        isOutsideRange,
      }
    })
    const monthStart = days.find((day) => Number(day.date.slice(-2)) === 1)
    return {
      monthLabel: weekIndex === 0
        ? monthFormatter.format(addDays(firstGridDay, weekIndex * 7))
        : monthStart
          ? monthFormatter.format(new Date(`${monthStart.date}T12:00:00`))
          : '',
      days,
    }
  })

  return {
    weeks,
    totalWorkouts,
    activeDays,
    completedSets,
    rangeStart: rangeStartKey,
    rangeEnd: rangeEndKey,
  }
}

export function buildWorkoutCalendar(
  workouts: WorkoutSession[],
  now = Date.now(),
  weekCount = 52,
): WorkoutCalendar {
  const today = startOfLocalDay(new Date(now))
  const currentWeekStart = startOfWeek(today)
  const safeWeekCount = Math.max(1, Math.round(weekCount))
  const firstDay = addDays(currentWeekStart, -(safeWeekCount - 1) * 7)
  return buildCalendarRange(workouts, today, firstDay, safeWeekCount, firstDay, addDays(currentWeekStart, 6))
}

export function buildWorkoutMonth(workouts: WorkoutSession[], now = Date.now()): WorkoutCalendar {
  const today = startOfLocalDay(new Date(now))
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const firstGridDay = startOfWeek(monthStart)
  const lastGridDay = addDays(monthEnd, 6 - monthEnd.getDay())
  const weekCount = Math.round((lastGridDay.getTime() - firstGridDay.getTime()) / (7 * 86_400_000)) + 1
  return buildCalendarRange(workouts, today, firstGridDay, weekCount, monthStart, monthEnd)
}

export function getAllTimeCalendarWeekCount(workouts: WorkoutSession[], now = Date.now()) {
  const today = startOfLocalDay(new Date(now))
  const currentWeekStart = startOfWeek(today)
  let earliestWeekStart = currentWeekStart
  for (const workout of workouts) {
    const timestamp = completedWorkoutDate(workout)
    if (timestamp && timestamp.getTime() <= today.getTime() && timestamp.getTime() < earliestWeekStart.getTime()) {
      earliestWeekStart = startOfWeek(timestamp)
    }
  }
  return Math.round((currentWeekStart.getTime() - earliestWeekStart.getTime()) / (7 * 86_400_000)) + 1
}
