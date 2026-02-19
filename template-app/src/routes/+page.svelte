<script lang="ts">
  import { untrack } from 'svelte';
  import { resolve } from '$app/paths';
  import { auth } from '$lib/auth.svelte';
  import { XrpcList } from '$lib/stores/xrpc-list.svelte';
  import type { PageProps } from './$types';
  import type { LexRecord, AgentValue } from '$lib/types';

  let { data }: PageProps = $props();

  // Seeded with SSR data — no flash, load-more works immediately.
  // untrack: intentionally reads data once at init; XrpcList owns the state from here.
  const agents = new XrpcList<LexRecord<AgentValue>>(
    'org.openassociation.listAgents',
    { limit: 20 },
    untrack(() => data),
  );
</script>

<main>
  <h1>Open Association</h1>

  {#if auth.isLoggedIn}
    <p>Signed in as <code>{auth.did}</code> · <button onclick={() => auth.logout()}>Log out</button></p>
  {:else}
    <p><a href={resolve('/login')}>Log in</a> to create and update records.</p>
  {/if}

  <h2>Agents</h2>

  {#if agents.error}
    <p class="error">{agents.error}</p>
  {:else if agents.isEmpty}
    <p>No agents found.</p>
  {:else}
    <ul>
      {#each agents.records as agent (agent.uri)}
        <li>
          <a href="/agents/{encodeURIComponent(agent.uri)}">
            {agent.value?.name ?? agent.uri}
          </a>
        </li>
      {/each}
    </ul>

    {#if agents.hasMore}
      <button onclick={() => agents.loadMore()} disabled={agents.loading}>
        {agents.loading ? 'Loading…' : 'Load more'}
      </button>
    {/if}
  {/if}
</main>

<style>
  main {
    max-width: 640px;
    margin: 2rem auto;
    padding: 0 1rem;
    font-family: system-ui, sans-serif;
  }

  .error {
    color: red;
  }
</style>
