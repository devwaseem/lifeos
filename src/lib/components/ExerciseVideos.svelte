<script lang="ts">
  import { ExternalLink, Link2, Play, Plus, Trash2, Video, X } from '@lucide/svelte'
  import { onDestroy } from 'svelte'
  import type { ExerciseVideo } from '$lib/types'
  import { newId } from '$lib/utils'
  import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl, parseYouTubeVideoId } from '$lib/youtube'
  import ConfirmDialog from './ConfirmDialog.svelte'

  export let exerciseId: string
  export let exerciseName: string
  export let videos: ExerciseVideo[]
  export let onSave: (video: ExerciseVideo) => void
  export let onDelete: (videoId: string) => void

  let sourceUrl = ''
  let error = ''
  let adding = false
  let selectedVideo: ExerciseVideo | null = null
  let deleteCandidate: ExerciseVideo | null = null
  let playerDialog: HTMLDialogElement
  let deleteDialog: ConfirmDialog

  $: youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exerciseName} exercise form`)}`

  function saveVideo() {
    const videoId = parseYouTubeVideoId(sourceUrl)
    if (!videoId) {
      error = 'Paste a valid YouTube video, Short, or youtu.be link.'
      return
    }
    if (videos.some((video) => video.videoId === videoId)) {
      error = 'That video is already saved for this exercise.'
      return
    }

    onSave({
      id: newId(),
      exerciseId,
      videoId,
      sourceUrl: sourceUrl.trim(),
      createdAt: new Date().toISOString(),
    })
    sourceUrl = ''
    error = ''
    adding = false
  }

  function cancelAdd() {
    adding = false
    sourceUrl = ''
    error = ''
  }

  function playVideo(video: ExerciseVideo) {
    selectedVideo = video
    playerDialog.showModal()
    if (playerDialog.requestFullscreen) {
      void playerDialog.requestFullscreen().catch(() => {
        // The dialog already fills the viewport when the Fullscreen API is unavailable.
      })
    }
  }

  function stopVideo() {
    if (playerDialog.open) playerDialog.close()
  }

  function handlePlayerClose() {
    selectedVideo = null
    if (document.fullscreenElement === playerDialog) {
      void document.exitFullscreen().catch(() => {})
    }
  }

  function askToDelete(video: ExerciseVideo) {
    deleteCandidate = video
    deleteDialog.open()
  }

  function deleteVideo() {
    if (!deleteCandidate) return
    onDelete(deleteCandidate.id)
    deleteCandidate = null
  }

  onDestroy(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement === playerDialog) {
      void document.exitFullscreen().catch(() => {})
    }
  })
</script>

<section class="mt-5" aria-labelledby="videos-heading">
  <div>
    <p class="font-dot text-xs text-accent">FORM STUDY</p>
    <h2 id="videos-heading" class="mt-1 text-xl font-medium">Saved videos</h2>
    <p class="mt-1 text-sm leading-6 text-muted">Your selected references for {exerciseName}.</p>
  </div>

  {#if videos.length === 0}
    <div class="mt-5 rounded-2xl bg-paper p-6">
      <Video class="size-6 text-accent" />
      <p class="mt-4 font-medium">No form videos saved</p>
      <p class="mt-2 max-w-xl text-sm leading-6 text-muted">Find a useful YouTube video, copy its link, and save it here. It will stay attached to this exercise on this device.</p>
    </div>
  {:else}
    <div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {#each videos as video, index (video.id)}
        <article class="min-w-0 overflow-hidden rounded-2xl bg-paper">
          <button class="group relative block aspect-video w-full overflow-hidden bg-panel" on:click={() => playVideo(video)} aria-label={`Play saved ${exerciseName} video ${index + 1} full screen`}>
            <img class="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" src={getYouTubeThumbnailUrl(video.videoId)} alt="" loading="lazy" />
            <span class="absolute inset-0 grid place-items-center bg-ink/20"><span class="grid size-12 place-items-center rounded-full bg-accent text-accent-ink"><Play class="ml-0.5 size-5" /></span></span>
          </button>
          <div class="flex min-w-0 items-center justify-between gap-3 p-3">
            <div class="min-w-0"><p class="font-dot text-xs text-accent">REFERENCE {String(index + 1).padStart(2, '0')}</p><p class="mt-1 truncate text-sm text-muted">YouTube · saved locally</p></div>
            <button class="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger" on:click={() => askToDelete(video)} aria-label={`Remove saved ${exerciseName} video ${index + 1}`}><Trash2 class="size-4" /></button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  <div class="mt-6 border-t border-rule pt-5">
    {#if videos.length > 0 && !adding}
      <div class="flex flex-wrap items-center gap-2">
        <button class="inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-4 text-sm font-medium" type="button" on:click={() => { adding = true }}><Plus class="size-4 text-accent" /> Add another video</button>
        <a class="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted hover:bg-paper hover:text-ink" href={youtubeSearchUrl} target="_blank" rel="noreferrer">Find on YouTube <ExternalLink class="size-4" /></a>
      </div>
    {:else}
      <form class="rounded-2xl bg-paper p-4 sm:p-5" on:submit|preventDefault={saveVideo}>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <label for="exercise-video-link" class="flex items-center gap-2 text-xs font-medium uppercase"><Link2 class="size-4 text-accent" /> YouTube link</label>
          <a class="inline-flex min-h-9 items-center gap-2 text-xs font-medium text-muted hover:text-ink" href={youtubeSearchUrl} target="_blank" rel="noreferrer">Find on YouTube <ExternalLink class="size-3.5" /></a>
        </div>
        <div class="mt-3 flex flex-col gap-2 sm:flex-row">
          <input id="exercise-video-link" bind:value={sourceUrl} on:input={() => { error = '' }} class="min-h-12 min-w-0 flex-1 rounded-xl border-0 bg-canvas px-4 text-base outline-none placeholder:text-muted" type="text" inputmode="url" autocomplete="url" maxlength="2048" placeholder="youtube.com/watch?v=…" aria-describedby={error ? 'exercise-video-error' : undefined} aria-invalid={error ? 'true' : undefined} required />
          <button class="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-ink" type="submit"><Plus class="size-4" /> Save video</button>
        </div>
        {#if error}<p id="exercise-video-error" class="mt-3 text-sm text-danger" role="alert">{error}</p>{/if}
        {#if videos.length > 0}<button class="mt-3 min-h-10 px-2 text-sm text-muted hover:text-ink" type="button" on:click={cancelAdd}>Cancel</button>{/if}
      </form>
    {/if}
  </div>
</section>

<dialog bind:this={playerDialog} data-fullscreen-dialog on:close={handlePlayerClose} class="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-ink p-0 text-paper backdrop:bg-ink">
  {#if selectedVideo}
    <div class="relative grid h-full w-full place-items-center bg-ink">
      <iframe class="h-full w-full" src={getYouTubeEmbedUrl(selectedVideo.videoId, true)} title={`${exerciseName} form video`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      <button class="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] z-10 grid size-12 place-items-center rounded-full bg-ink/80 text-paper backdrop-blur" on:click={stopVideo} aria-label="Close video"><X class="size-5" /></button>
    </div>
  {/if}
</dialog>

<ConfirmDialog bind:this={deleteDialog} eyebrow="Saved video" title="Remove this video?" description={`It will no longer appear under ${exerciseName}.`} confirmLabel="Remove" onConfirm={deleteVideo} />
