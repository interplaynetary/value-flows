<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { aip } from '$lib/aip.svelte';

  // Exchange the authorization code for a token on the client only
  if (browser) {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (error) {
      aip.error = decodeURIComponent(params.get('error_description') ?? error);
    } else if (code && state) {
      aip.handleCallback(code, state).then((ok) => {
        if (ok) goto(resolve('/'));
      });
    } else {
      aip.error = 'Missing authorization code.';
    }
  }
</script>

<main>
  {#if aip.loading}
    <p>Completing sign-in…</p>
  {:else if aip.error}
    <p class="error">{aip.error}</p>
    <a href={resolve('/login')}>Try again</a>
  {/if}
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 50vh;
    gap: 1rem;
    font-family: system-ui, sans-serif;
  }

  .error {
    color: var(--error, #dc2626);
  }
</style>
