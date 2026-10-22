<script lang="ts">
  import { onMount, tick } from 'svelte'
  import type { TransitionConfig } from 'svelte/transition'
  import type { AiSettings } from '$lib/ai-coach'
  import { createAppleHealthShortcutUrl, createPendingAppleHealthExport, isAppleHealthShortcutAvailable, type AppleHealthExportRecord } from '$lib/apple-health'
  import ActiveWorkoutView from '$lib/components/ActiveWorkoutView.svelte'
  import ConfirmDialog from '$lib/components/ConfirmDialog.svelte'
  import AppShell from '$lib/components/AppShell.svelte'
  import ExerciseDetailView from '$lib/components/ExerciseDetailView.svelte'
  import ExerciseLibraryView from '$lib/components/ExerciseLibraryView.svelte'
  import HistoryView from '$lib/components/HistoryView.svelte'
  import MoreView from '$lib/components/MoreView.svelte'
  import TrainingProgressReport from '$lib/components/TrainingProgressReport.svelte'
  import WorkoutCompleteDialog from '$lib/components/WorkoutCompleteDialog.svelte'
  import WorkoutHistoryDetailView from '$lib/components/WorkoutHistoryDetailView.svelte'
  import RoutineLibraryView from '$lib/components/RoutineLibraryView.svelte'
  import SettingsView from '$lib/components/SettingsView.svelte'
  import TodayView from '$lib/components/TodayView.svelte'
  import WorkoutStartDialog from '$lib/components/WorkoutStartDialog.svelte'
  import WorkoutCheckInDialog from '$lib/components/WorkoutCheckInDialog.svelte'
  import { createDemoWorkouts } from '$lib/data/demo-workouts'
  import { exerciseLibrary } from '$lib/data/exercises'
  import { createOneOffWorkout, createWorkoutFromRoutine, routineFromWorkout } from '$lib/routines'
  import { deleteAppleHealthExport, deleteExerciseVideo, getAiSettings, getAppleHealthExports, getCustomExercises, getExerciseVideos, getRoutines, getSyncSettings, getTrainingCycle, getTrainingProfile, getWorkouts, replaceRoutines, replaceTrainingCycle, replaceTrainingProfile, replaceWorkouts, saveAiSettings, saveAppleHealthExport, saveCustomExercise, saveExerciseVideo, saveRoutine, saveSyncSettings, saveTrainingCycle, saveTrainingProfile, saveWorkout } from '$lib/storage'
  import { mergeRoutines, mergeTrainingCycle, mergeTrainingProfile, mergeWorkouts, syncData } from '$lib/sync'
  import { advanceTrainingCycleForWorkout, removeRoutineFromTrainingCycle } from '$lib/training-cycle'
  import { buildTrainingProgressReport } from '$lib/training-progress-report'
  import { getConsecutiveLoadDays } from '$lib/training-readiness'
  import type { AppView, ExerciseDefinition, ExerciseVideo, RoutineTemplate, SyncSettings, TrainingCycle, TrainingProfile, WorkoutCheckIn, WorkoutFinishDecision, WorkoutSession } from '$lib/types'

  let view: AppView = 'today'
  let workouts: WorkoutSession[] = []
  let customExercises: ExerciseDefinition[] = []
  let routines: RoutineTemplate[] = []
  let trainingCycle: TrainingCycle | null = null
  let trainingProfile: TrainingProfile | null = null
  let exerciseVideos: ExerciseVideo[] = []
  let selectedExerciseId = ''
  let selectedExerciseName = ''
  let selectedWorkoutId = ''
  let exerciseBackView: AppView = 'history'
  let settings: SyncSettings = { deviceId: '', lastSyncedAt: null, syncCursor: null }
  let loading = true
  let online = true
  let now = Date.now()
  let syncState: 'idle' | 'syncing' | 'success' | 'error' = 'idle'
  let syncError: string | null = null
  let aiSettings: AiSettings = { provider: 'gemini', models: {}, apiKeys: {}, cloudflareAccountId: '' }
  let dataError: string | null = null
  let appleHealthExports: AppleHealthExportRecord[] = []
  let canExportToAppleHealth = false
  let appleHealthActionError: string | null = null
  let completedWorkoutForHealth: WorkoutSession | null = null
  let startDialog: WorkoutStartDialog
  let fatigueDialog: ConfirmDialog
  let workoutCompleteDialog: WorkoutCompleteDialog
  let checkInDialog: WorkoutCheckInDialog
  let pendingWorkoutStart: { kind: 'routine'; routine: RoutineTemplate; cycleSlotId: string | null } | { kind: 'custom' } | null = null
  let selectedRoutineId = ''
  const TODAY_ROUTINE_KEY = 'lifeos-today-routine-id'
  const notifiedRestTimers = new Set<string>()
  const demoWorkoutIds = new Set<string>()
  const viewDepth: Record<AppView, number> = {
    history: 0,
    today: 0,
    more: 0,
    report: 1,
    'workout-history': 1,
    routines: 1,
    exercises: 1,
    settings: 1,
    exercise: 2,
    workout: 2,
  }
  const rootViewOrder: Partial<Record<AppView, number>> = { history: 0, today: 1, more: 2 }
  const navigationStateKey = 'lifeosNavigation'
  const appViews = new Set<AppView>(['history', 'today', 'more', 'report', 'workout-history', 'routines', 'exercises', 'settings', 'exercise', 'workout'])
  let pageDirection: -1 | 0 | 1 = 1
  let navigationIndex = 0
  let navigationReady = false
  let requestedBackTransition = false

  interface AppNavigationState {
    index: number
    view: AppView
    selectedWorkoutId: string
    selectedExerciseId: string
    selectedExerciseName: string
    exerciseBackView: AppView
  }

  function isAppView(value: unknown): value is AppView {
    return typeof value === 'string' && appViews.has(value as AppView)
  }

  function getNavigationDirection(nextView: AppView): -1 | 1 {
    const currentRootOrder = rootViewOrder[view]
    const nextRootOrder = rootViewOrder[nextView]
    if (currentRootOrder !== undefined && nextRootOrder !== undefined && currentRootOrder !== nextRootOrder) {
      return nextRootOrder > currentRootOrder ? 1 : -1
    }
    if (viewDepth[nextView] !== viewDepth[view]) return viewDepth[nextView] > viewDepth[view] ? 1 : -1
    return 1
  }

  function currentNavigationState(nextView = view, index = navigationIndex): AppNavigationState {
    return {
      index,
      view: nextView,
      selectedWorkoutId,
      selectedExerciseId,
      selectedExerciseName,
      exerciseBackView,
    }
  }

  function navigationUrl(state: AppNavigationState) {
    const params = new URLSearchParams()
    if (state.view !== 'today') params.set('view', state.view)
    if (state.view === 'workout-history' && state.selectedWorkoutId) params.set('workout', state.selectedWorkoutId)
    if (state.view === 'exercise' && state.selectedExerciseId) {
      params.set('exercise', state.selectedExerciseId)
      if (state.selectedExerciseName) params.set('name', state.selectedExerciseName)
      params.set('from', state.exerciseBackView)
    }
    const query = params.toString()
    return query ? `/?${query}` : '/'
  }

  function navigationFromLocation(index = 0): AppNavigationState {
    const params = new URLSearchParams(window.location.search)
    let nextView: AppView = isAppView(params.get('view')) ? params.get('view') as AppView : 'today'
    const nextWorkoutId = params.get('workout') ?? ''
    const nextExerciseId = params.get('exercise') ?? ''
    const nextExerciseName = params.get('name') ?? ''
    const requestedExerciseBackView = params.get('from')
    const nextExerciseBackView = isAppView(requestedExerciseBackView) ? requestedExerciseBackView : 'history'
    if (nextView === 'workout-history' && !nextWorkoutId) nextView = 'history'
    if (nextView === 'exercise' && !nextExerciseId) nextView = nextExerciseBackView === 'exercises' ? 'exercises' : 'history'
    return {
      index,
      view: nextView,
      selectedWorkoutId: nextWorkoutId,
      selectedExerciseId: nextExerciseId,
      selectedExerciseName: nextExerciseName,
      exerciseBackView: nextExerciseBackView,
    }
  }

  function navigationFromHistoryState(state: unknown): AppNavigationState | null {
    if (!state || typeof state !== 'object') return null
    const candidate = (state as Record<string, unknown>)[navigationStateKey]
    if (!candidate || typeof candidate !== 'object') return null
    const navigation = candidate as Partial<AppNavigationState>
    if (!Number.isInteger(navigation.index) || !isAppView(navigation.view)) return null
    return {
      index: navigation.index as number,
      view: navigation.view,
      selectedWorkoutId: typeof navigation.selectedWorkoutId === 'string' ? navigation.selectedWorkoutId : '',
      selectedExerciseId: typeof navigation.selectedExerciseId === 'string' ? navigation.selectedExerciseId : '',
      selectedExerciseName: typeof navigation.selectedExerciseName === 'string' ? navigation.selectedExerciseName : '',
      exerciseBackView: isAppView(navigation.exerciseBackView) ? navigation.exerciseBackView : 'history',
    }
  }

  function resetPageScroll() {
    window.requestAnimationFrame(() => window.scrollTo(0, 0))
  }

  function rememberActiveWorkoutScroll(nextView: AppView) {
    if (view !== 'workout' || nextView === 'workout' || !activeWorkout) return
    try {
      sessionStorage.setItem(`lifeos-workout-scroll:${activeWorkout.id}`, String(window.scrollY))
    } catch {
      // Scroll restoration is an enhancement; navigation still works without session storage.
    }
  }

  function applyNavigationState(state: AppNavigationState, direction: -1 | 0 | 1) {
    rememberActiveWorkoutScroll(state.view)
    pageDirection = direction
    selectedWorkoutId = state.selectedWorkoutId
    selectedExerciseId = state.selectedExerciseId
    selectedExerciseName = state.selectedExerciseName
    exerciseBackView = state.exerciseBackView
    view = state.view
    resetPageScroll()
  }

  function writeNavigationState(state: AppNavigationState, replace = false) {
    const historyState = {
      ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}),
      [navigationStateKey]: state,
    }
    if (replace) window.history.replaceState(historyState, '', navigationUrl(state))
    else window.history.pushState(historyState, '', navigationUrl(state))
  }

  function initializeNavigation() {
    const storedState = navigationFromHistoryState(window.history.state)
    navigationIndex = storedState?.index ?? 0
    const initialState = navigationFromLocation(navigationIndex)
    writeNavigationState(initialState, true)
    applyNavigationState(initialState, 0)
    window.history.scrollRestoration = 'manual'
    navigationReady = true
  }

  function handlePopState(event: PopStateEvent) {
    const state = navigationFromHistoryState(event.state) ?? navigationFromLocation(Math.max(0, navigationIndex - 1))
    const direction = requestedBackTransition ? -1 : 0
    requestedBackTransition = false
    navigationIndex = state.index
    applyNavigationState(state, direction)
  }

  function navigate(nextView: AppView, direction: -1 | 0 | 1 = getNavigationDirection(nextView)) {
    if (nextView === view) return
    rememberActiveWorkoutScroll(nextView)
    pageDirection = direction
    view = nextView
    resetPageScroll()
    if (!navigationReady) return
    navigationIndex += 1
    writeNavigationState(currentNavigationState(nextView, navigationIndex))
  }

  function navigateWithoutTransition(nextView: AppView) {
    navigate(nextView, 0)
  }

  function navigateBack(fallbackView: AppView) {
    const currentState = navigationFromHistoryState(window.history.state)
    if (navigationReady && currentState && currentState.index > 0) {
      requestedBackTransition = true
      window.history.back()
      return
    }
    navigate(fallbackView, -1)
  }

  function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function pageIn(_node: Element): TransitionConfig {
    const direction = pageDirection
    if (pageDirection === 0 || prefersReducedMotion()) return { duration: 0 }
    if (direction < 0) return { duration: 240, css: () => 'z-index: 1' }
    return {
      duration: 280,
      easing: (t) => 1 - Math.pow(1 - t, 5),
      css: (t) => `z-index: 2; transform: translate3d(${(1 - t) * 100}%, 0, 0)`,
    }
  }

  function pageOut(_node: Element): TransitionConfig {
    const direction = pageDirection
    if (pageDirection === 0 || prefersReducedMotion()) return { duration: 0 }
    if (direction > 0) return { duration: 280, css: () => 'z-index: 1' }
    return {
      duration: 240,
      easing: (t) => t * t * t * t,
      css: (t) => `z-index: 2; transform: translate3d(${(1 - t) * 100}%, 0, 0)`,
    }
  }
  function upsertAppleHealthExport(exportRecord: AppleHealthExportRecord) {
    appleHealthExports = [
      exportRecord,
      ...appleHealthExports.filter((record) => record.workoutId !== exportRecord.workoutId),
    ]
  }

  async function exportWorkoutToAppleHealth(workout: WorkoutSession) {
    appleHealthActionError = null
    if (!canExportToAppleHealth) {
      appleHealthActionError = 'Open LifeOS on your iPhone or iPad to export this workout.'
      return false
    }

    const attemptId = crypto.randomUUID()
    const attemptedAt = new Date().toISOString()
    const existing = appleHealthExports.find((record) => record.workoutId === workout.id)
    const nextRecord: AppleHealthExportRecord = {
      ...(existing ?? createPendingAppleHealthExport(workout)),
      workoutUpdatedAt: workout.updatedAt,
      status: 'exporting',
      attemptId,
      attemptedAt,
      lastError: null,
    }

    try {
      await saveAppleHealthExport(nextRecord)
      upsertAppleHealthExport(nextRecord)
      window.location.href = createAppleHealthShortcutUrl(workout)
      return true
    } catch (error) {
      appleHealthActionError = error instanceof Error
        ? error.message
        : 'LifeOS could not start the Apple Health export.'
      return false
    }
  }

  function createProgressReport(_sourceVersion: string) {
    let latestCheckIn: WorkoutCheckIn | null = null
    let latestWorkoutUpdatedAt: string | null = null
    for (const workout of workouts) {
      if (!latestWorkoutUpdatedAt || workout.updatedAt > latestWorkoutUpdatedAt) latestWorkoutUpdatedAt = workout.updatedAt
      if (workout.checkIn && (!latestCheckIn || workout.checkIn.recordedAt > latestCheckIn.recordedAt)) latestCheckIn = workout.checkIn
    }
    return buildTrainingProgressReport({
      workouts,
      routines,
      trainingCycle,
      profile: trainingProfile,
      latestCheckIn,
      freshness: {
        latestDeviceSyncAt: settings.lastSyncedAt,
        latestWorkoutUpdatedAt,
      },
    })
  }

  $: activeWorkout = workouts.find((workout) => workout.status === 'active')
  $: visibleRoutines = routines.filter((routine) => !routine.deletedAt)
  $: selectedWorkout = workouts.find((workout) => workout.id === selectedWorkoutId)
  $: allExercises = [...exerciseLibrary, ...customExercises]
  $: syncLabel = settings.lastSyncedAt ? 'Saved locally & synced' : 'Saved locally'
  $: selectedAppleHealthExport = appleHealthExports.find((record) => record.workoutId === selectedWorkoutId)
  $: reportSourceVersion = [
    ...workouts.map((workout) => `${workout.id}:${workout.updatedAt}`),
    ...routines.map((routine) => `${routine.id}:${routine.updatedAt}`),
    trainingCycle ? `${trainingCycle.id}:${trainingCycle.updatedAt}` : 'no-cycle',
    trainingProfile?.updatedAt ?? 'no-profile',
    settings.lastSyncedAt ?? 'not-synced',
  ].join('|')
  $: progressReport = createProgressReport(reportSourceVersion)

  onMount(() => {
    let cancelled = false
    initializeNavigation()
    online = navigator.onLine
    canExportToAppleHealth = isAppleHealthShortcutAvailable(navigator)
    const handleOnline = () => { online = true }
    const handleOffline = () => { online = false }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('popstate', handlePopState)

    Promise.all([getWorkouts(), getRoutines(), getTrainingCycle(), getSyncSettings(), getCustomExercises(), getExerciseVideos(), getAppleHealthExports(), getTrainingProfile(), getAiSettings()])
      .then(async ([storedWorkouts, storedRoutines, storedTrainingCycle, storedSettings, storedCustomExercises, storedExerciseVideos, storedAppleHealthExports, storedTrainingProfile, storedAiSettings]) => {
        if (cancelled) return
        const demoWorkouts = createDemoWorkouts()
        demoWorkouts.forEach((workout) => demoWorkoutIds.add(workout.id))
        const demoById = new Map(demoWorkouts.map((workout) => [workout.id, workout]))
        const storedUserWorkouts = storedWorkouts.filter((workout) => !demoById.has(workout.id))
        const storedDemos = storedWorkouts.filter((workout) => demoById.has(workout.id))
        const hydratedDemos = demoWorkouts.map((demo) => {
          const stored = storedDemos.find((workout) => workout.id === demo.id)
          return stored && stored.sessionRpe !== null ? stored : demo
        })
        const canSync = navigator.onLine
        const shouldPullDevelopmentData = import.meta.env.DEV && canSync
        const initialWorkouts = storedUserWorkouts.length > 0
          ? storedUserWorkouts
          : import.meta.env.DEV
            ? hydratedDemos
            : []

        workouts = initialWorkouts
        routines = storedRoutines
        trainingCycle = storedTrainingCycle
        selectedRoutineId = readStoredRoutineId()
        ensureSelectedRoutine(storedRoutines)
        settings = storedSettings
        customExercises = storedCustomExercises
        exerciseVideos = storedExerciseVideos
        appleHealthExports = storedAppleHealthExports
        trainingProfile = storedTrainingProfile
        aiSettings = storedAiSettings

        if (canSync) {
          const synced = await performSync(
            storedSettings,
            shouldPullDevelopmentData ? [] : storedUserWorkouts,
            shouldPullDevelopmentData ? [] : storedRoutines,
            shouldPullDevelopmentData ? null : storedTrainingCycle,
            shouldPullDevelopmentData ? null : storedTrainingProfile,
            !shouldPullDevelopmentData,
          )
          if (!synced && !cancelled) {
            workouts = initialWorkouts
            routines = storedRoutines
            trainingCycle = storedTrainingCycle
            trainingProfile = storedTrainingProfile
            ensureSelectedRoutine(storedRoutines)
          } else if (import.meta.env.DEV && !cancelled && workouts.length === 0) {
            workouts = hydratedDemos
            await replaceWorkouts(hydratedDemos)
          }
        } else if (storedWorkouts.length !== initialWorkouts.length
          || initialWorkouts.some((workout, index) => workout !== storedWorkouts[index])) {
          await replaceWorkouts(initialWorkouts)
        }
      })
      .catch(() => { if (!cancelled) dataError = 'LifeOS could not open local storage. Check this browser’s site-storage permissions.' })
      .finally(() => { if (!cancelled) loading = false })

    const clock = window.setInterval(() => {
      now = Date.now()
      checkRestTimers(now)
    }, 1000)
    return () => {
      cancelled = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('popstate', handlePopState)
      navigationReady = false
      window.clearInterval(clock)
    }
  })

  function checkRestTimers(timestamp: number) {
    const current = workouts.find((workout) => workout.status === 'active')
    if (!current) return
    const expired = current.exercises.filter((exercise) => exercise.restUntil && new Date(exercise.restUntil).getTime() <= timestamp)
    if (expired.length === 0) return

    for (const exercise of expired) {
      const key = `${exercise.id}:${exercise.restUntil}`
      if (!notifiedRestTimers.has(key)) {
        notifiedRestTimers.add(key)
        if ('Notification' in window && Notification.permission === 'granted') {
          void showRestNotification(exercise.name)
        }
      }
    }

    updateWorkout({
      ...current,
      exercises: current.exercises.map((exercise) => expired.some((item) => item.id === exercise.id) ? { ...exercise, restUntil: null } : exercise),
      updatedAt: new Date().toISOString(),
    })
  }

  async function showRestNotification(exerciseName: string) {
    const options = { body: `${exerciseName}: start the next set.`, tag: `rest-${exerciseName}` }
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined
    if (registration) {
      await registration.showNotification('Rest complete', options)
      return
    }
    new Notification('Rest complete', options)
  }

  async function performSync(
    nextSettings = settings,
    nextWorkouts = workouts,
    nextRoutines = routines,
    nextTrainingCycle = trainingCycle,
    nextTrainingProfile = trainingProfile,
    mergeLocalData = true,
  ) {
    syncState = 'syncing'
    syncError = null
    try {
      const response = await syncData(
        mergeLocalData ? nextSettings : { ...nextSettings, syncCursor: null },
        nextWorkouts,
        nextRoutines,
        nextTrainingCycle,
        nextTrainingProfile,
      )
      const mergedWorkouts = mergeWorkouts(mergeLocalData ? nextWorkouts : [], response.workouts)
      const mergedRoutines = mergeRoutines(mergeLocalData ? nextRoutines : [], response.routines)
      const mergedTrainingCycle = mergeTrainingCycle(mergeLocalData ? nextTrainingCycle : null, response.trainingCycle ?? null)
      const mergedTrainingProfile = mergeTrainingProfile(mergeLocalData ? nextTrainingProfile : null, response.profile ?? null)
      const updatedSettings = { ...nextSettings, lastSyncedAt: response.syncedAt, syncCursor: response.cursor }
      await Promise.all([
        replaceWorkouts(mergedWorkouts),
        replaceRoutines(mergedRoutines),
        replaceTrainingCycle(mergedTrainingCycle),
        saveSyncSettings(updatedSettings),
        replaceTrainingProfile(mergedTrainingProfile),
      ])
      workouts = mergedWorkouts
      routines = mergedRoutines
      trainingCycle = mergedTrainingCycle
      trainingProfile = mergedTrainingProfile
      ensureSelectedRoutine(mergedRoutines)
      settings = updatedSettings
      syncState = 'success'
      return true
    } catch (error) {
      syncError = error instanceof Error ? error.message : 'Sync failed. Your local data is unchanged.'
      syncState = 'error'
      return false
    }
  }

  function readStoredRoutineId() {
    try {
      return localStorage.getItem(TODAY_ROUTINE_KEY) ?? ''
    } catch {
      return ''
    }
  }

  function selectTodayRoutine(routineId: string) {
    selectedRoutineId = routineId
    try {
      if (routineId) localStorage.setItem(TODAY_ROUTINE_KEY, routineId)
      else localStorage.removeItem(TODAY_ROUTINE_KEY)
    } catch {
      // IndexedDB still retains every workout and routine if preferences storage is unavailable.
    }
  }

  function ensureSelectedRoutine(nextRoutines: RoutineTemplate[]) {
    const available = nextRoutines.filter((routine) => !routine.deletedAt)
    if (!available.some((routine) => routine.id === selectedRoutineId)) {
      selectTodayRoutine(available[0]?.id ?? '')
    }
  }

  async function handleSync() {
    const settingsWithDevice = { ...settings, deviceId: settings.deviceId || crypto.randomUUID() }
    await saveSyncSettings(settingsWithDevice)
    settings = settingsWithDevice
    await performSync(settingsWithDevice, workouts.filter((workout) => !demoWorkoutIds.has(workout.id)), routines)
  }

  function storeTrainingProfile(profile: TrainingProfile) {
    trainingProfile = profile
    saveTrainingProfile(profile).catch(() => { dataError = 'The training profile could not be saved locally.' })
    if (navigator.onLine) void performSync(settings, workouts, routines, trainingCycle, profile)
  }

  function storeAiSettings(nextSettings: AiSettings) {
    aiSettings = nextSettings
    saveAiSettings(nextSettings).catch(() => { dataError = 'The AI provider preference could not be saved locally.' })
  }



  function requestWorkoutStart() {
    if (activeWorkout) { navigate('workout'); return }
    startDialog.open()
  }

  function startRoutine(routine: RoutineTemplate, cycleSlotId: string | null = null) {
    if (activeWorkout) { navigate('workout'); return }
    pendingWorkoutStart = { kind: 'routine', routine, cycleSlotId }
    checkInDialog.open()
  }

  function startCycleRoutine(routine: RoutineTemplate, slotId: string) {
    startRoutine(routine, slotId)
  }

  function requestRoutineStart(routine: RoutineTemplate) {
    if (activeWorkout) { navigate('workout'); return }
    selectTodayRoutine(routine.id)
    if (getConsecutiveLoadDays(workouts) >= 3) {
      navigate('today', -1)
      return
    }
    startRoutine(routine)
  }
  function startCustomWorkout(forceOverride = false) {
    if (activeWorkout) { navigate('workout'); return }
    if (!forceOverride && getConsecutiveLoadDays(workouts) >= 3) {
      fatigueDialog.open()
      return
    }
    pendingWorkoutStart = { kind: 'custom' }
    checkInDialog.open()
  }

  function startCheckedInWorkout(checkIn: WorkoutCheckIn) {
    const pending = pendingWorkoutStart
    pendingWorkoutStart = null
    if (!pending || activeWorkout) return

    let workout: WorkoutSession
    if (pending.kind === 'routine') {
      workout = createWorkoutFromRoutine(pending.routine, checkIn, checkIn.recordedAt, pending.cycleSlotId, workouts)
      selectTodayRoutine(pending.routine.id)
    } else {
      const hour = new Date(checkIn.recordedAt).getHours()
      const daypart = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening'
      workout = createOneOffWorkout(`${daypart} workout`, checkIn, checkIn.recordedAt)
    }
    workouts = [workout, ...workouts]
    saveWorkout(workout).catch(() => { dataError = 'This workout could not be saved locally.' })
    navigate('workout')
  }

  function updateWorkout(workout: WorkoutSession) {
    workouts = workouts.map((item) => item.id === workout.id ? workout : item)
    saveWorkout(workout).catch(() => { dataError = 'The latest edit could not be saved locally.' })
  }

  function createExercise(exercise: ExerciseDefinition) {
    customExercises = [...customExercises, exercise]
    saveCustomExercise(exercise).catch(() => { dataError = 'The custom exercise could not be saved locally.' })
  }

  function addExerciseVideo(video: ExerciseVideo) {
    exerciseVideos = [video, ...exerciseVideos]
    saveExerciseVideo(video).catch(() => { dataError = 'The exercise video could not be saved locally.' })
  }

  function removeExerciseVideo(videoId: string) {
    exerciseVideos = exerciseVideos.filter((video) => video.id !== videoId)
    deleteExerciseVideo(videoId).catch(() => { dataError = 'The exercise video could not be removed locally.' })
  }

  function openExercise(exerciseId: string, exerciseName: string) {
    selectedExerciseId = exerciseId
    selectedExerciseName = exerciseName
    exerciseBackView = view === 'exercises'
      ? 'exercises'
      : view === 'today' || view === 'workout' || view === 'workout-history' || view === 'report'
        ? view
        : 'history'
    navigate('exercise')
  }

  function openWorkout(workoutId: string) {
    selectedWorkoutId = workoutId
    navigate('workout-history')
  }

  function deleteSavedWorkout() {
    if (!selectedWorkout || selectedWorkout.status !== 'completed') return
    const timestamp = new Date().toISOString()
    const deleted: WorkoutSession = {
      ...selectedWorkout,
      status: 'cancelled',
      updatedAt: timestamp,
      notes: '',
      sessionRpe: null,
      exercises: [],
    }
    const nextWorkouts = workouts.map((workout) => workout.id === deleted.id ? deleted : workout)
    workouts = nextWorkouts
    selectedWorkoutId = ''
    saveWorkout(deleted).catch(() => { dataError = 'The deleted workout could not be saved locally.' })
    appleHealthExports = appleHealthExports.filter((record) => record.workoutId !== deleted.id)
    deleteAppleHealthExport(deleted.id).catch(() => { dataError = 'The Apple Health export state could not be removed locally.' })
    navigateBack('history')
    if (navigator.onLine) void performSync(settings, nextWorkouts, routines)
  }

  function storeRoutine(routine: RoutineTemplate) {
    const nextRoutines = [routine, ...routines.filter((item) => item.id !== routine.id)]
    routines = nextRoutines
    saveRoutine(routine).catch(() => { dataError = 'The routine could not be saved locally.' })
    if (!selectedRoutineId && !routine.deletedAt) selectTodayRoutine(routine.id)
    if (navigator.onLine) void performSync(settings, workouts, nextRoutines)
  }

  function storeTrainingCycle(cycle: TrainingCycle) {
    trainingCycle = cycle
    saveTrainingCycle(cycle).catch(() => { dataError = 'The training cycle could not be saved locally.' })
    if (navigator.onLine) void performSync(settings, workouts, routines, cycle)
  }

  function deleteTrainingCycle(cycle: TrainingCycle) {
    const timestamp = new Date().toISOString()
    storeTrainingCycle({ ...cycle, updatedAt: timestamp, deletedAt: timestamp })
  }


  function deleteRoutine(routine: RoutineTemplate) {
    if (selectedRoutineId === routine.id) {
      selectTodayRoutine(visibleRoutines.find((item) => item.id !== routine.id)?.id ?? '')
    }
    const timestamp = new Date().toISOString()
    if (trainingCycle && !trainingCycle.deletedAt) {
      const nextCycle = removeRoutineFromTrainingCycle(trainingCycle, routine.id, timestamp)
      if (nextCycle.updatedAt === timestamp) {
        trainingCycle = nextCycle
        saveTrainingCycle(nextCycle).catch(() => { dataError = 'The training cycle could not be updated locally.' })
      }
    }
    storeRoutine({ ...routine, updatedAt: timestamp, deletedAt: timestamp })
  }

  function cancelWorkout() {
    if (!activeWorkout) return
    const timestamp = new Date().toISOString()
    const cancelled: WorkoutSession = {
      ...activeWorkout,
      status: 'cancelled',
      completedAt: timestamp,
      updatedAt: timestamp,
      notes: '',
      exercises: [],
    }
    const nextWorkouts = workouts.map((workout) => workout.id === cancelled.id ? cancelled : workout)
    workouts = nextWorkouts
    saveWorkout(cancelled).catch(() => { dataError = 'The cancelled workout could not be saved locally.' })
    navigateBack('today')
    if (navigator.onLine) void performSync(settings, nextWorkouts, routines)
  }

  function finishWorkout(decision: WorkoutFinishDecision) {
    if (!activeWorkout) return
    const timestamp = new Date().toISOString()
    let nextRoutines = routines
    let routineId = activeWorkout.routineId
    let routineToSave: RoutineTemplate | undefined

    if (decision.disposition === 'update-routine') {
      const existing = routines.find((routine) => routine.id === activeWorkout.routineId && !routine.deletedAt)
      if (existing) {
        routineToSave = routineFromWorkout(activeWorkout, existing.name, existing, timestamp)
        routineId = existing.id
      } else {
        routineId = null
      }
    } else if (decision.disposition === 'new-routine') {
      routineToSave = routineFromWorkout(activeWorkout, decision.routineName, undefined, timestamp)
      routineId = routineToSave.id
    } else if (decision.disposition === 'one-off') {
      routineId = null
    }

    if (routineToSave) {
      nextRoutines = [routineToSave, ...routines.filter((routine) => routine.id !== routineToSave?.id)]
      routines = nextRoutines
      saveRoutine(routineToSave).catch(() => { dataError = 'The routine could not be saved locally.' })
    }

    const completed: WorkoutSession = {
      ...activeWorkout,
      routineId,
      status: 'completed',
      completedAt: timestamp,
      updatedAt: timestamp,
      notes: decision.notes,
      sessionRpe: decision.sessionRpe,
    }
    const nextWorkouts = workouts.map((workout) => workout.id === completed.id ? completed : workout)
    let nextTrainingCycle = trainingCycle
    if (trainingCycle) {
      const advanced = advanceTrainingCycleForWorkout(trainingCycle, completed, timestamp)
      if (advanced.updatedAt === timestamp) {
        nextTrainingCycle = advanced
        trainingCycle = advanced
        saveTrainingCycle(advanced).catch(() => { dataError = 'The training cycle could not advance locally.' })
      }
    }
    workouts = nextWorkouts
    navigateBack('today')
    saveWorkout(completed)
      .then(async () => {
        const pendingExport = createPendingAppleHealthExport(completed)
        upsertAppleHealthExport(pendingExport)
        appleHealthActionError = null
        try {
          await saveAppleHealthExport(pendingExport)
        } catch {
          appleHealthActionError = 'The Apple Health reminder could not be saved, but you can still export this workout now.'
        }
        completedWorkoutForHealth = completed
        await tick()
        workoutCompleteDialog.open()
      })
      .catch(() => { dataError = 'The completed workout could not be saved locally.' })
    if (navigator.onLine) void performSync(settings, nextWorkouts, nextRoutines, nextTrainingCycle)
  }
</script>

<svelte:head><title>LifeOS Training</title></svelte:head>

{#if loading}
  <div class="grid min-h-dvh place-items-center bg-canvas px-6 text-center text-ink"><div><div class="font-dot mx-auto grid size-20 animate-pulse place-items-center rounded-full bg-accent text-sm text-accent-ink">LOAD</div><p class="mt-4 text-sm font-medium">Opening LifeOS</p></div></div>
{:else}
  <AppShell {view} onNavigate={navigateWithoutTransition} {online} {syncLabel} {activeWorkout} {now} onResume={() => navigate('workout')}>
    {#if dataError}<div class="mx-auto max-w-4xl px-5 pt-4 sm:px-8 lg:px-12" role="alert"><p class="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{dataError}</p></div>{/if}
    <div class="page-stack">
      {#key view}
        <div class="page-panel" in:pageIn out:pageOut>
          {#if view === 'today'}
            <TodayView {workouts} routines={visibleRoutines} {activeWorkout} {trainingCycle} {selectedRoutineId} {now} {progressReport} {aiSettings} {online} onSelectRoutine={selectTodayRoutine} onStartRoutine={startRoutine} onStartCycleRoutine={startCycleRoutine} onStart={requestWorkoutStart} onResume={() => navigate('workout')} onManageRoutines={() => navigate('routines')} onViewReport={() => navigate('report')} onOpenExercise={openExercise} />
          {:else if view === 'history'}
            <HistoryView {workouts} onStart={requestWorkoutStart} onOpenWorkout={openWorkout} />
          {:else if view === 'workout-history' && selectedWorkout}
            <WorkoutHistoryDetailView workout={selectedWorkout} {workouts} routines={visibleRoutines} exercises={allExercises} {trainingProfile} {aiSettings} {online} appleHealthExport={selectedAppleHealthExport} {canExportToAppleHealth} onExportAppleHealth={() => { void exportWorkoutToAppleHealth(selectedWorkout) }} onBack={() => navigateBack('history')} onOpenExercise={openExercise} onDelete={deleteSavedWorkout} />
          {:else if view === 'more'}
            <MoreView {online} {syncLabel} onNavigate={navigate} />
          {:else if view === 'report'}
            <TrainingProgressReport report={progressReport} {aiSettings} {online} onBack={() => navigateBack('more')} onOpenExercise={openExercise} />
          {:else if view === 'routines'}
            <RoutineLibraryView routines={visibleRoutines} {workouts} exercises={allExercises} {trainingProfile} {aiSettings} {online} {trainingCycle} {customExercises} {activeWorkout} onBack={() => navigateBack('more')} onSave={storeRoutine} onDelete={deleteRoutine} onStart={requestRoutineStart} onCreateExercise={createExercise} onSaveCycle={storeTrainingCycle} onDeleteCycle={deleteTrainingCycle} />
          {:else if view === 'exercises'}
            <ExerciseLibraryView {customExercises} onBack={() => navigateBack('more')} onCreate={createExercise} onOpenExercise={openExercise} />
          {:else if view === 'settings'}
            {#key `${settings.deviceId}:${settings.lastSyncedAt ?? 'never'}:${trainingProfile?.updatedAt ?? 'no-profile'}:${aiSettings.provider}`}
              <SettingsView
                initialSettings={settings}
                {syncState}
                {syncError}
                {trainingProfile}
                {aiSettings}
                onBack={() => navigateBack('more')}
                onSync={handleSync}
                onSaveProfile={storeTrainingProfile}
                onSaveAiSettings={storeAiSettings}
              />
            {/key}
          {:else if view === 'exercise' && selectedExerciseId}
            <ExerciseDetailView exerciseId={selectedExerciseId} exerciseName={selectedExerciseName} {workouts} routines={visibleRoutines} exercises={allExercises} {trainingProfile} {aiSettings} {online} videos={exerciseVideos.filter((video) => video.exerciseId === selectedExerciseId)} onSaveVideo={addExerciseVideo} onDeleteVideo={removeExerciseVideo} onBack={() => navigateBack(exerciseBackView)} />
          {:else if view === 'workout' && activeWorkout}
            <ActiveWorkoutView workout={activeWorkout} {workouts} routines={visibleRoutines} onBack={() => navigateBack('today')} onChange={updateWorkout} {customExercises} onCreateExercise={createExercise} onOpenExercise={openExercise} onFinish={finishWorkout} onCancel={cancelWorkout} />
          {/if}
        </div>
      {/key}
    </div>
  </AppShell>
{/if}

<WorkoutStartDialog bind:this={startDialog} routines={visibleRoutines} onSelectRoutine={requestRoutineStart} onCustom={startCustomWorkout} onManageRoutines={() => navigate('routines')} />
<WorkoutCheckInDialog bind:this={checkInDialog} onSubmit={startCheckedInWorkout} onCancel={() => { pendingWorkoutStart = null }} />
<ConfirmDialog bind:this={fatigueDialog} eyebrow="Heuristic governor" title="Systemic fatigue warning" description="Three or more consecutive training days are logged. Continue only if this additional load is intentional and recovery is adequate." confirmLabel="Force override" onConfirm={() => startCustomWorkout(true)} />
<WorkoutCompleteDialog bind:this={workoutCompleteDialog} workout={completedWorkoutForHealth} canExport={canExportToAppleHealth} error={appleHealthActionError} onExport={exportWorkoutToAppleHealth} />

<style>
  .page-stack {
    display: grid;
    min-height: 100dvh;
    overflow-x: clip;
    isolation: isolate;
  }

  .page-panel {
    grid-area: 1 / 1;
    min-width: 0;
    min-height: 100dvh;
    background: var(--color-canvas);
  }
</style>
