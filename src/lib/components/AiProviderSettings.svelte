<script lang="ts">
  import { onMount } from 'svelte'
  import { CloudCog, RefreshCw } from '@lucide/svelte'
  import { getAiProviderCatalog, type AiProviderCatalog, type AiProviderId, type AiProviderPreference, type AiSettings } from '$lib/ai-coach'
  export let settings: AiSettings
  export let onSave: (settings: AiSettings) => void

  let provider: AiProviderPreference = settings.provider
  let models: AiSettings['models'] = { ...settings.models }
  let apiKeys: AiSettings['apiKeys'] = { ...settings.apiKeys }
  let cloudflareAccountId = settings.cloudflareAccountId
  let catalog: AiProviderCatalog | null = null
  let loading = true
  let error: string | null = null
  let saved = false

  $: selectedId = (provider === 'auto' ? catalog?.defaultProvider : provider) ?? 'gemini'
  $: selectedOption = catalog?.providers.find((option) => option.id === selectedId) ?? null

  async function loadProviders() {
    loading = true
    error = null
    try {
      catalog = await getAiProviderCatalog()
      if (provider === 'auto') provider = catalog.defaultProvider ?? 'gemini'
      for (const option of catalog.providers) {
        if (!models[option.id]) models[option.id] = option.model
      }
      models = { ...models }
    } catch (reason) {
      error = reason instanceof Error ? reason.message : 'LifeOS could not read the available AI providers.'
    } finally {
      loading = false
    }
  }

  function updateModel(id: AiProviderId, value: string) {
    models = { ...models, [id]: value }
    saved = false
  }

  function updateApiKey(id: AiProviderId, value: string) {
    apiKeys = { ...apiKeys, [id]: value }
    saved = false
  }

  function submit() {
    const normalizedModels: AiSettings['models'] = {}
    const normalizedApiKeys: AiSettings['apiKeys'] = {}
    for (const id of ['workers-ai', 'gemini', 'anthropic'] as const) {
      const model = models[id]?.trim()
      const apiKey = apiKeys[id]?.trim()
      if (model) normalizedModels[id] = model
      if (apiKey) normalizedApiKeys[id] = apiKey
    }
    onSave({
      provider: selectedId,
      models: normalizedModels,
      apiKeys: normalizedApiKeys,
      cloudflareAccountId: cloudflareAccountId.trim(),
    })
    saved = true
  }

  onMount(loadProviders)
</script>

<form class="mt-3 rounded-2xl bg-paper p-5 sm:p-6" on:submit|preventDefault={submit}>
  <div class="flex items-start justify-between gap-4">
    <div class="max-w-2xl">
      <p class="font-dot text-xs text-accent">MODEL ROUTING</p>
      <h2 class="mt-2 text-xl font-medium text-balance">AI provider</h2>
      <p class="mt-2 text-sm leading-6 text-muted text-pretty">Select a provider, model identifier, and optional API key. Gemini is the default cloud provider; Cloudflare Workers AI and Anthropic are also supported.</p>
    </div>
    <CloudCog class="size-5 shrink-0 text-muted" />
  </div>

  {#if error}
    <div class="mt-5 flex items-start justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3 text-danger" role="alert">
      <p class="text-sm leading-5">{error}</p>
      <button class="shrink-0" type="button" on:click={loadProviders} aria-label="Retry loading AI providers"><RefreshCw class="size-4" /></button>
    </div>
  {:else if loading}
    <p class="mt-5 text-sm text-muted" role="status">Reading available providers…</p>
  {:else if catalog && selectedOption}
    <div class="mt-6 grid max-w-xl gap-5">
      <label class="grid gap-2 text-sm font-medium">Provider
        <select class="min-h-12 rounded-xl border border-rule bg-canvas px-3 text-base" bind:value={provider} on:change={() => { saved = false }}>
          {#each catalog.providers as option (option.id)}
            <option value={option.id}>{option.label}</option>
          {/each}
        </select>
      </label>

      <label class="grid gap-2 text-sm font-medium">Model identifier
        <input
          class="min-h-12 min-w-0 rounded-xl border border-rule bg-canvas px-3 font-mono text-sm"
          value={models[selectedId] ?? selectedOption.model}
          on:input={(event) => updateModel(selectedId, event.currentTarget.value)}
          maxlength="200"
          pattern="[A-Za-z0-9@._:/-]+"
          required
          spellcheck="false"
          aria-label={`${selectedOption.label} model identifier`}
        />
      </label>

      <label class="grid gap-2 text-sm font-medium">API key
        <input
          class="min-h-12 min-w-0 rounded-xl border border-rule bg-canvas px-3 font-mono text-sm"
          type="password"
          value={apiKeys[selectedId] ?? ''}
          on:input={(event) => updateApiKey(selectedId, event.currentTarget.value)}
          maxlength="4096"
          autocomplete="new-password"
          spellcheck="false"
          placeholder="Use server-side credential when blank"
          aria-label={`${selectedOption.label} API key`}
        />
      </label>

      {#if selectedId === 'workers-ai'}
        <label class="grid gap-2 text-sm font-medium">Cloudflare account ID
          <input
            class="min-h-12 min-w-0 rounded-xl border border-rule bg-canvas px-3 font-mono text-sm"
            bind:value={cloudflareAccountId}
            on:input={() => { saved = false }}
            maxlength="64"
            autocomplete="off"
            spellcheck="false"
            placeholder="Required with a browser-saved Workers AI token"
          />
        </label>
      {/if}
    </div>
  {/if}

  <p class="mt-5 text-xs leading-5 text-muted">Keys entered here are stored only in this browser and sent to same-origin AI endpoints when generating a brief or analysis; they are never included in LifeOS sync. Leave the key blank to use a credential configured on the server. Private workout and check-in notes are excluded from AI context.</p>
  {#if saved}<p class="mt-4 text-sm text-success" role="status">AI configuration saved.</p>{/if}
  <button class="mt-6 min-h-12 w-full rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-accent disabled:cursor-not-allowed disabled:bg-panel-deep disabled:text-muted sm:w-auto" type="submit" disabled={loading || !selectedOption}>Save AI configuration</button>
</form>
