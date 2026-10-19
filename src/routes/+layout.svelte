<script lang="ts">
  import '@fontsource-variable/ibm-plex-sans'
  import '@fontsource-variable/doto'
  import '../styles.css'
  import { onMount } from 'svelte'
  import { registerServiceWorker } from '$lib/service-worker-registration'

  onMount(() => {
    if ('serviceWorker' in navigator) {
      void registerServiceWorker(navigator.serviceWorker).catch(() => {})
    }
  })
</script>

<slot />
