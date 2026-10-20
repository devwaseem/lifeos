<script lang="ts">
  import { ArrowLeft, Cloud, Database, RefreshCw } from '@lucide/svelte'
  import TrainingProfileForm from './TrainingProfileForm.svelte'
  import type { SyncSettings, TrainingProfile } from '$lib/types'
  import { formatShortDate, formatTime } from '$lib/utils'

  export let initialSettings: SyncSettings
  export let onBack: () => void
  export let syncState: 'idle' | 'syncing' | 'success' | 'error'
  export let syncError: string | null
  export let onSync: () => Promise<void>
  export let trainingProfile: TrainingProfile | null
  export let onSaveProfile: (profile: TrainingProfile) => void
</script>

<div class="mx-auto w-full max-w-5xl px-5 py-6 sm:px-6 lg:px-8 lg:py-7">
  <header class="flex items-start gap-3">
    <button class="grid size-11 shrink-0 place-items-center rounded-full border border-ink" on:click={onBack} aria-label="Back to More"><ArrowLeft class="size-5" /></button>
    <div class="min-w-0"><p class="font-dot text-xs text-accent">SYSTEM</p><h1 class="mt-2 text-2xl font-medium text-balance">Data & AI</h1><p class="mt-3 max-w-xl text-sm leading-6 text-muted text-pretty">Keep training context local-first and synchronize the data your AI client can analyze.</p></div>
  </header>

  <section class="mt-8 grid grid-cols-2 gap-3">
    <div class="flex min-h-36 flex-col justify-between rounded-2xl bg-accent p-5 text-accent-ink"><Database class="size-5" /><span><span class="font-dot block text-2xl">LOCAL</span><span class="mt-1 block text-xs text-accent-ink/80">Always available</span></span></div>
    <div class="flex min-h-36 flex-col justify-between rounded-2xl bg-paper p-5"><Cloud class="size-5" /><span><span class="font-dot block text-2xl">{initialSettings.lastSyncedAt ? 'SYNCED' : 'WAITING'}</span><span class="mt-1 block text-xs text-muted">{initialSettings.lastSyncedAt ? `${formatShortDate(initialSettings.lastSyncedAt)} · ${formatTime(initialSettings.lastSyncedAt)}` : 'Not synced yet'}</span></span></div>
  </section>

  <form class="mt-3 rounded-2xl bg-paper p-5 sm:p-6" on:submit|preventDefault={onSync}>
    <h2 class="text-base font-medium">Private cloud sync</h2>
    <p class="mt-2 max-w-xl text-sm leading-6 text-muted text-pretty">Cloudflare Access protects this app and its data. LifeOS uses your current signed-in session, so there is no separate app password.</p>
    {#if syncError}<p class="mt-5 rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">{syncError}</p>{/if}
    {#if syncState === 'success'}<p class="mt-5 rounded-xl bg-success-soft px-4 py-3 text-sm text-success" role="status">Local and cloud data are up to date.</p>{/if}
    <button class="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent disabled:cursor-wait disabled:bg-panel-deep disabled:text-muted sm:w-auto" type="submit" disabled={syncState === 'syncing'}><RefreshCw class={syncState === 'syncing' ? 'size-4 animate-spin' : 'size-4'} />{syncState === 'syncing' ? 'Syncing…' : 'Sync now'}</button>
  </form>

  <div class="mt-10">
    <TrainingProfileForm profile={trainingProfile} onSave={onSaveProfile} />
  </div>
</div>
