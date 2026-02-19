<script lang="ts">
  import { browser } from '$app/environment';
  import { auth } from '$lib/auth.svelte';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();

  // Load persisted session on the client only — sessionStorage is not available on the server
  if (browser) {
    auth.loadFromStorage();
  }
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
