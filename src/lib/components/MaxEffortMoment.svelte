<script lang="ts">
  import { Flame } from '@lucide/svelte'
  import { onMount } from 'svelte'

  export let exerciseName: string
  export let onComplete: () => void

  const embers = [
    { x: -34, rise: -180, delay: 20, scale: 0.7 },
    { x: -25, rise: -260, delay: 90, scale: 1 },
    { x: -14, rise: -210, delay: 0, scale: 0.8 },
    { x: -5, rise: -300, delay: 130, scale: 0.65 },
    { x: 8, rise: -230, delay: 40, scale: 0.9 },
    { x: 18, rise: -285, delay: 110, scale: 0.75 },
    { x: 29, rise: -200, delay: 10, scale: 1.05 },
    { x: 36, rise: -250, delay: 150, scale: 0.7 },
  ]

  onMount(() => {
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1_500 : 2_400
    const timer = window.setTimeout(onComplete, duration)
    return () => window.clearTimeout(timer)
  })
</script>

<div class="max-effort-moment" role="status" aria-live="polite" aria-atomic="true">
  <span class="sr-only">RPE 10. {exerciseName} set completed at maximum effort.</span>
  <span class="impact-ring ring-one" aria-hidden="true"></span>
  <span class="impact-ring ring-two" aria-hidden="true"></span>
  <span class="strike-line" aria-hidden="true"></span>
  <div class="embers" aria-hidden="true">
    {#each embers as ember}
      <Flame
        class="ember"
        color="var(--color-accent)"
        fill="var(--color-accent)"
        strokeWidth={1.25}
        style={`--x:${ember.x}vw;--rise:${ember.rise}px;--delay:${ember.delay}ms;--scale:${ember.scale}`}
      />
    {/each}
  </div>
  <div class="moment-mark" aria-hidden="true">
    <Flame class="hero-flame" color="var(--color-accent)" fill="var(--color-accent)" strokeWidth={1.25} />
    <p class="moment-kicker font-dot">LIMIT REACHED</p>
    <p class="moment-exercise">{exerciseName}</p>
    <p class="moment-detail">RPE 10 · SET COMPLETE</p>
  </div>
</div>

<style>
  .max-effort-moment {
    position: fixed;
    inset: 0;
    z-index: 70;
    display: grid;
    overflow: hidden;
    place-items: center;
    pointer-events: none;
    background-color: color-mix(in srgb, var(--color-ink) 96%, transparent);
    animation: moment-visibility 2400ms linear both;
  }
  .moment-mark { position: relative; z-index: 2; display: grid; max-width: min(82vw, 30rem); justify-items: center; text-align: center; animation: mark-impact 720ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  :global(.hero-flame) { width: clamp(4.5rem, 17vw, 7rem); height: clamp(4.5rem, 17vw, 7rem); }
  .moment-kicker { margin-top: 0.75rem; color: var(--color-accent); font-size: clamp(1.6rem, 7vw, 3.5rem); line-height: 0.9; letter-spacing: -0.04em; }
  .moment-exercise { max-width: 100%; margin-top: 0.7rem; overflow: hidden; color: var(--color-paper); font-size: clamp(1rem, 4vw, 1.35rem); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
  .moment-detail { margin-top: 0.35rem; color: var(--color-panel-deep); font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; }
  .impact-ring { position: absolute; left: 50%; top: 50%; width: min(72vw, 30rem); aspect-ratio: 1; border: 2px solid var(--color-accent); border-radius: 999px; opacity: 0; transform: translate(-50%, -50%) scale(0.2); animation: ring-release 1000ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .ring-two { animation-delay: 160ms; }
  .strike-line { position: absolute; left: 0; top: 50%; width: 100%; height: 2px; background: var(--color-accent); opacity: 0; transform: scaleX(0); animation: strike 700ms cubic-bezier(0.16, 1, 0.3, 1) both; }
  .embers { position: absolute; inset: 0; }
  :global(.ember) { position: absolute; left: 50%; top: calc(50% + 9rem); width: 1.4rem; height: 1.4rem; opacity: 0; animation: ember-rise 1200ms var(--delay) cubic-bezier(0.16, 1, 0.3, 1) both; }
  @keyframes moment-visibility {
    0%, 100% { opacity: 0; }
    6%, 84% { opacity: 1; }
  }
  @keyframes mark-impact {
    0% { opacity: 0; transform: scale(0.72); }
    42% { opacity: 1; transform: scale(1.04); }
    100% { opacity: 1; transform: scale(1); }
  }
  @keyframes ring-release {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
    28% { opacity: 0.8; }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25); }
  }
  @keyframes strike {
    0% { opacity: 0; transform: scaleX(0); }
    35% { opacity: 0.9; transform: scaleX(1); }
    100% { opacity: 0; transform: scaleX(1); }
  }
  @keyframes ember-rise {
    0% { opacity: 0; transform: translate(-50%, 0) scale(calc(var(--scale) * 0.65)) rotate(-8deg); }
    24% { opacity: 0.9; }
    100% { opacity: 0; transform: translate(calc(-50% + var(--x)), var(--rise)) scale(var(--scale)) rotate(9deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .max-effort-moment, .moment-mark { animation: none; }
    .impact-ring, .strike-line, .embers { display: none; }
  }
</style>
