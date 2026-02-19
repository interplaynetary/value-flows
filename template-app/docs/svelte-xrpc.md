# Svelte 5 + XRPC Integration

This guide shows how to integrate the HappyView XRPC API into a Svelte 5 / SvelteKit application using runes. The patterns here are idiomatic Svelte 5 — no legacy stores, no writable/readable wrappers, no `$effect`.

**Core principle**: prefer `$derived.by` over `$effect` for data fetching. `$derived.by` can return a Promise, pairs naturally with `{#await}`, and re-fetches automatically when any reactive dependency changes — no manual wiring, no cleanup, no stale-closure bugs. Reserve `$effect` for true fire-and-forget side effects (analytics, focus management, etc.).

## XRPC Client (`src/lib/xrpc.svelte.ts`)

A thin typed wrapper around fetch. Use the `.svelte.ts` extension so runes work if you add reactive state to it later.

```ts
// src/lib/xrpc.svelte.ts

const BASE_URL = import.meta.env.VITE_HAPPYVIEW_URL as string;

export class XrpcError extends Error {
  constructor(
    public readonly error: string,
    message: string,
    public readonly status: number
  ) {
    super(message || error);
  }
}

/** GET /xrpc/{nsid} — unauthenticated */
export async function query<T>(
  nsid: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "NetworkError" }));
    throw new XrpcError(body.error, body.message, res.status);
  }
  return res.json();
}

/** POST /xrpc/{nsid} — requires Bearer token */
export async function procedure<T>(
  nsid: string,
  body: unknown,
  token: string
): Promise<T> {
  const res = await fetch(`${BASE_URL}/xrpc/${nsid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "NetworkError" }));
    throw new XrpcError(err.error, err.message, res.status);
  }
  return res.json();
}
```

---

## Paginated List Store (`src/lib/stores/xrpc-list.svelte.ts`)

A reusable class that encapsulates list state with pagination. Reactive class fields (`$state`, `$derived`) work exactly like component state.

```ts
// src/lib/stores/xrpc-list.svelte.ts
import { query, type XrpcError } from "$lib/xrpc.svelte";

export interface ListResponse<T> {
  records: T[];
  cursor?: string;
}

export class XrpcList<T> {
  records = $state<T[]>([]);
  cursor = $state<string | undefined>(undefined);
  loading = $state(false);
  error = $state<string | null>(null);

  // $derived reads reactive fields of this class
  hasMore = $derived(this.cursor !== undefined);
  isEmpty = $derived(!this.loading && this.records.length === 0);

  #nsid: string;
  #baseParams: Record<string, string | number | undefined>;

  constructor(
    nsid: string,
    params: Record<string, string | number | undefined> = {},
    initial?: { records: T[]; cursor?: string }
  ) {
    this.#nsid = nsid;
    this.#baseParams = params;
    if (initial) {
      this.records = initial.records;
      this.cursor = initial.cursor;
    }
  }

  async load(params: Record<string, string | number | undefined> = {}) {
    this.loading = true;
    this.error = null;
    try {
      const data = await query<ListResponse<T>>(this.#nsid, {
        ...this.#baseParams,
        ...params,
      });
      this.records = data.records;
      this.cursor = data.cursor;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  async loadMore() {
    if (!this.cursor || this.loading) return;
    this.loading = true;
    try {
      const data = await query<ListResponse<T>>(this.#nsid, {
        ...this.#baseParams,
        cursor: this.cursor,
      });
      this.records = [...this.records, ...data.records];
      this.cursor = data.cursor;
    } catch (e: any) {
      this.error = e.message;
    } finally {
      this.loading = false;
    }
  }

  reset() {
    this.records = [];
    this.cursor = undefined;
    this.error = null;
  }
}
```

---

## Auth Store (`src/lib/auth.svelte.ts`)

Token state lives in a `.svelte.ts` module so it's shared across all components that import it.

> **SSR note**: Module-level `$state` is shared across all server requests. If you use SSR, keep this store client-only by gating reads behind `if (browser)` (imported from `$app/environment`), or use SvelteKit's context API (`setContext`/`getContext`) in your root layout instead.

```ts
// src/lib/auth.svelte.ts

export const auth = {
  token: $state<string | null>(null),
  did: $state<string | null>(null),

  get isLoggedIn() {
    return this.token !== null;
  },

  setSession(token: string, did: string) {
    this.token = token;
    this.did = did;
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("did", did);
  },

  loadFromStorage() {
    this.token = sessionStorage.getItem("token");
    this.did = sessionStorage.getItem("did");
  },

  logout() {
    this.token = null;
    this.did = null;
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("did");
  },
};
```

---

## Simple Read-Only List

For views that just display records, `$derived.by` returning a Promise is the cleanest pattern — no class, no effect, fully reactive.

```svelte
<!-- src/routes/agents/+page.svelte -->
<script lang="ts">
  import { query } from "$lib/xrpc.svelte";

  // Re-evaluates automatically whenever any reactive dependency changes
  const agents = $derived.by(() =>
    query<{ records: any[]; cursor?: string }>("org.openassociation.listAgents", { limit: 20 })
  );
</script>

{#await agents}
  <p>Loading…</p>
{:then { records }}
  <ul>
    {#each records as agent (agent.uri)}
      <li>
        <a href="/agents/{encodeURIComponent(agent.uri)}">
          {agent.value?.name ?? agent.uri}
        </a>
      </li>
    {/each}
  </ul>
{:catch error}
  <p class="error">{error.message}</p>
{/await}
```

## Paginated List (load-more)

Use `XrpcList` when you need to append pages. Initial data comes from the SvelteKit load function so there's no effect needed — the constructor seeds the state directly.

```ts
// src/routes/agents/+page.ts
import { query } from "$lib/xrpc.svelte";
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async () => {
  return await query<{ records: any[]; cursor?: string }>(
    "org.openassociation.listAgents",
    { limit: 20 }
  );
};
```

```svelte
<!-- src/routes/agents/+page.svelte -->
<script lang="ts">
  import { XrpcList } from "$lib/stores/xrpc-list.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Seed with SSR data — no effect, no flash, load-more just works
  const agents = new XrpcList("org.openassociation.listAgents", { limit: 20 }, data);
</script>

{#each agents.records as agent (agent.uri)}
  <a href="/agents/{encodeURIComponent(agent.uri)}">
    {agent.value?.name ?? agent.uri}
  </a>
{/each}

{#if agents.hasMore}
  <button onclick={() => agents.loadMore()} disabled={agents.loading}>
    {agents.loading ? "Loading…" : "Load more"}
  </button>
{/if}
```

---

## DID-Filtered View (User's Own Records)

`$derived.by` re-evaluates automatically when `auth.did` changes — no effect needed.

```svelte
<!-- src/routes/my-intents/+page.svelte -->
<script lang="ts">
  import { query } from "$lib/xrpc.svelte";
  import { auth } from "$lib/auth.svelte";

  // Reactive: re-fetches whenever auth.did changes
  const intents = $derived.by(() =>
    auth.did
      ? query<{ records: any[] }>("org.openassociation.listIntents", { did: auth.did, limit: 50 })
      : Promise.resolve({ records: [] })
  );
</script>

{#if !auth.isLoggedIn}
  <p>Log in to see your intents.</p>
{:else}
  {#await intents}
    <p>Loading…</p>
  {:then { records }}
    {#if records.length === 0}
      <p>No intents yet.</p>
    {:else}
      {#each records as intent (intent.uri)}
        <div class="intent">
          <strong>{intent.value?.name ?? "Unnamed"}</strong>
          <span>{intent.value?.note}</span>
        </div>
      {/each}
    {/if}
  {:catch error}
    <p class="error">{error.message}</p>
  {/await}
{/if}
```

---

## Single Record by URI

```svelte
<!-- src/routes/agents/[uri]/+page.svelte -->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // data.agent comes from the load function below
</script>

{#if data.agent}
  <h1>{data.agent.value?.name ?? "Agent"}</h1>
  <p>{data.agent.value?.note}</p>
{/if}
```

```ts
// src/routes/agents/[uri]/+page.ts
import { query } from "$lib/xrpc.svelte";
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async ({ params }) => {
  const uri = decodeURIComponent(params.uri);
  const data = await query<{ record: any }>("org.openassociation.listAgents", { uri });
  return { agent: data.record };
};
```

---

## SvelteKit SSR — Prefetch on the Server

For collections that should be SSR'd, query in `+page.ts`. The `XrpcList` class is client-only (uses `$state`), so for SSR pass data via the load function and hydrate on the client.

```ts
// src/routes/economic-events/+page.ts
import { query } from "$lib/xrpc.svelte";
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async () => {
  const { records, cursor } = await query<{ records: any[]; cursor?: string }>(
    "org.openassociation.listEconomicEvents",
    { limit: 20 }
  );
  return { records, cursor };
};
```

```svelte
<!-- src/routes/economic-events/+page.svelte -->
<script lang="ts">
  import { XrpcList } from "$lib/stores/xrpc-list.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Pass SSR data as initial state — no $effect flash, load-more works immediately
  const events = new XrpcList("org.openassociation.listEconomicEvents", { limit: 20 }, data);
</script>

{#each events.records as event (event.uri)}
  <div>{event.value?.note}</div>
{/each}

{#if events.hasMore}
  <button onclick={() => events.loadMore()}>Load more</button>
{/if}
```

---

## Creating Records (Procedures)

Procedure endpoints (`POST /xrpc/{nsid}`) proxy writes to the user's AT Protocol PDS and return the created record's URI and CID.

```svelte
<!-- src/lib/components/CreateAgentForm.svelte -->
<script lang="ts">
  import { procedure } from "$lib/xrpc.svelte";
  import { auth } from "$lib/auth.svelte";

  let name = $state("");
  let agentType = $state<"person" | "organization" | "ecologicalAgent">("person");
  let saving = $state(false);
  let error = $state<string | null>(null);
  let createdUri = $state<string | null>(null);

  async function create() {
    if (!auth.token) return;
    saving = true;
    error = null;
    try {
      const result = await procedure<{ uri: string; cid: string }>(
        "org.openassociation.createAgent",
        { name, agentType },
        auth.token
      );
      createdUri = result.uri;
      name = "";
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); create(); }}>
  <input bind:value={name} placeholder="Name" required />
  <select bind:value={agentType}>
    <option value="person">Person</option>
    <option value="organization">Organization</option>
    <option value="ecologicalAgent">Ecological Agent</option>
  </select>
  <button type="submit" disabled={saving || !auth.isLoggedIn}>
    {saving ? "Saving…" : "Create agent"}
  </button>
</form>

{#if error}<p class="error">{error}</p>{/if}
{#if createdUri}<p>Created: <code>{createdUri}</code></p>{/if}
```

---

## Updating Records

HappyView auto-detects an update when the request body contains a `uri` field. Use the same procedure NSID:

```ts
// Update an existing agent
await procedure(
  "org.openassociation.createAgent",
  { uri: existingUri, name: "Updated Name", agentType: "organization" },
  auth.token!
);
```

---

## Reactive Cross-Collection Joins

Reference fields in records are AT-URIs pointing to other records. Use `$derived.by` to resolve them — it re-fetches automatically when the prop changes, no effect or manual state needed.

```svelte
<script lang="ts">
  import { query } from "$lib/xrpc.svelte";

  // An economic event whose `resourceInventoriedAs` field is an AT-URI
  let { event }: { event: any } = $props();

  // Re-fetches whenever event.value.resourceInventoriedAs changes
  const resource = $derived.by(() =>
    event.value?.resourceInventoriedAs
      ? query<{ record: any }>("org.openassociation.listEconomicResources", {
          uri: event.value.resourceInventoriedAs,
        }).then((d) => d.record)
      : Promise.resolve(null)
  );
</script>

{#await resource then r}
  <p>Resource: {r?.value?.name ?? "…"}</p>
{/await}
```

For multiple related fields, chain them. `action`, `resourceInventoriedAs`, and `inputOf` are all AT-URIs — resolve each one independently:

```svelte
<script lang="ts">
  let { event }: { event: any } = $props();

  const action = $derived.by(() =>
    event.value?.action
      ? query<{ record: any }>("org.openassociation.listActions", {
          uri: event.value.action,
        }).then((d) => d.record)
      : Promise.resolve(null)
  );

  const resource = $derived.by(() =>
    event.value?.resourceInventoriedAs
      ? query<{ record: any }>("org.openassociation.listEconomicResources", {
          uri: event.value.resourceInventoriedAs,
        }).then((d) => d.record)
      : Promise.resolve(null)
  );

  const process = $derived.by(() =>
    event.value?.inputOf
      ? query<{ record: any }>("org.openassociation.listProcesses", {
          uri: event.value.inputOf,
        }).then((d) => d.record)
      : Promise.resolve(null)
  );
</script>

{#await action then a}
  <span>Action: {a?.value?.label}</span>
{/await}

{#await resource then r}
  <span>Resource: {r?.value?.name}</span>
{/await}

{#await process then p}
  <span>Process: {p?.value?.name}</span>
{/await}
```

---

## Pagination Pattern Summary

```
First request:  GET /xrpc/org.openassociation.listAgents?limit=20
Response:       { records: [...20], cursor: "20" }

Next page:      GET /xrpc/org.openassociation.listAgents?limit=20&cursor=20
Response:       { records: [...20], cursor: "40" }

Last page:      { records: [...5] }          ← no cursor = end of results
```

Keep all other params identical between pages. The `XrpcList.loadMore()` method handles this automatically.

**Filtering by action**: `action` is a linked record (at-uri), not an enum string. Pass the full AT-URI of the action record:

```
GET /xrpc/org.openassociation.listEconomicEvents?action=at://did:plc:xxx/org.openassociation.action/consume
```

To get an action's AT-URI, fetch it by `actionId`:

```ts
const { records } = await query<{ records: any[] }>("org.openassociation.listActions", {
  // use uri filter if you already have the at-uri, or browse all actions
  limit: 50,
});
const consume = records.find((r) => r.value?.actionId === "consume");
// consume.uri is the AT-URI to use in action filters
```

---

## Environment Variables

```env
# .env
VITE_HAPPYVIEW_URL=https://your-happyview.up.railway.app
VITE_AIP_URL=https://your-aip.up.railway.app
```
