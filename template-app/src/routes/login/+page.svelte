<script lang="ts">
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import LoginForm from '$lib/components/LoginForm.svelte';
</script>

{#if auth.isLoggedIn}
  <p>You're already signed in. <a href={resolve('/')}>Go home</a></p>
{:else}
  <main>
    <h1>Sign in</h1>
    <LoginForm />
  </main>
{/if}

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    padding: 4rem 1rem;
    font-family: system-ui, sans-serif;
  }

  h1 {
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0;
  }
</style>
