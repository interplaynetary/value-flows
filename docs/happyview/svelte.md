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
<!-- src/routes/persons/+page.svelte -->
<script lang="ts">
  import { query } from "$lib/xrpc.svelte";

  // Re-evaluates automatically whenever any reactive dependency changes
  const persons = $derived.by(() =>
    query<{ records: any[]; cursor?: string }>("vf.observation.listPersons", { limit: 20 })
  );
</script>

{#await persons}
  <p>Loading…</p>
{:then { records }}
  <ul>
    {#each records as person (person.uri)}
      <li>
        <a href="/persons/{encodeURIComponent(person.uri)}">
          {person.value?.name ?? person.uri}
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
// src/routes/persons/+page.ts
import { query } from "$lib/xrpc.svelte";
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async () => {
  return await query<{ records: any[]; cursor?: string }>(
    "vf.observation.listPersons",
    { limit: 20 }
  );
};
```

```svelte
<!-- src/routes/persons/+page.svelte -->
<script lang="ts">
  import { XrpcList } from "$lib/stores/xrpc-list.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Seed with SSR data — no effect, no flash, load-more just works
  const persons = new XrpcList("vf.observation.listPersons", { limit: 20 }, data);
</script>

{#each persons.records as person (person.uri)}
  <a href="/persons/{encodeURIComponent(person.uri)}">
    {person.value?.name ?? person.uri}
  </a>
{/each}

{#if persons.hasMore}
  <button onclick={() => persons.loadMore()} disabled={persons.loading}>
    {persons.loading ? "Loading…" : "Load more"}
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
      ? query<{ records: any[] }>("vf.planning.listIntents", { did: auth.did, limit: 50 })
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
<!-- src/routes/persons/[uri]/+page.svelte -->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // data.person comes from the load function below
</script>

{#if data.person}
  <h1>{data.person.value?.name ?? "Person"}</h1>
  <p>{data.person.value?.note}</p>
{/if}
```

```ts
// src/routes/persons/[uri]/+page.ts
import { query } from "$lib/xrpc.svelte";
import type { PageLoad } from "@sveltejs/kit";

export const load: PageLoad = async ({ params }) => {
  const uri = decodeURIComponent(params.uri);
  const data = await query<{ record: any }>("vf.observation.listPersons", { uri });
  return { person: data.record };
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
    "vf.observation.listEconomicEvents",
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
  const events = new XrpcList("vf.observation.listEconomicEvents", { limit: 20 }, data);
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
<!-- src/lib/components/CreateUnitForm.svelte -->
<script lang="ts">
  import { procedure } from "$lib/xrpc.svelte";
  import { auth } from "$lib/auth.svelte";

  let label = $state("");
  let symbol = $state("");
  let saving = $state(false);
  let error = $state<string | null>(null);
  let createdUri = $state<string | null>(null);

  async function create() {
    if (!auth.token) return;
    saving = true;
    error = null;
    try {
      const result = await procedure<{ uri: string; cid: string }>(
        "vf.knowledge.createUnit",
        { label, symbol },
        auth.token
      );
      createdUri = result.uri;
      label = "";
      symbol = "";
    } catch (e: any) {
      error = e.message;
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); create(); }}>
  <input bind:value={label} placeholder="Label (e.g. kilogram)" required />
  <input bind:value={symbol} placeholder="Symbol (e.g. kg)" />
  <button type="submit" disabled={saving || !auth.isLoggedIn}>
    {saving ? "Saving…" : "Create unit"}
  </button>
</form>

{#if error}<p class="error">{error}</p>{/if}
{#if createdUri}<p>Created: <code>{createdUri}</code></p>{/if}
```

---

## Updating Records

HappyView auto-detects an update when the request body contains a `uri` field. Use the same procedure NSID:

```ts
// Update an existing unit
await procedure(
  "vf.knowledge.createUnit",
  { uri: existingUri, label: "kilogram", symbol: "kg" },
  auth.token!
);
```

---

## Reactive Cross-Collection Joins

Reference fields in VF records are AT-URIs pointing to other records. Use `$derived.by` to resolve them — it re-fetches automatically when the prop changes, no effect or manual state needed.

```svelte
<script lang="ts">
  import { query } from "$lib/xrpc.svelte";

  // An economic event whose `action` field is an AT-URI
  let { event }: { event: any } = $props();

  // Re-fetches whenever event.value.action changes
  const action = $derived.by(() =>
    event.value?.action
      ? query<{ record: any }>("vf.knowledge.listActions", { uri: event.value.action })
          .then((d) => d.record)
      : Promise.resolve(null)
  );
</script>

{#await action then a}
  <p>Action: {a?.value?.label ?? "…"}</p>
{/await}
```

For multiple related fields, chain them:

```svelte
<script lang="ts">
  let { event }: { event: any } = $props();

  const action = $derived.by(() =>
    event.value?.action
      ? query<{ record: any }>("vf.knowledge.listActions", { uri: event.value.action })
          .then((d) => d.record)
      : Promise.resolve(null)
  );

  const resource = $derived.by(() =>
    event.value?.resourceInventoriedAs
      ? query<{ record: any }>("vf.observation.listEconomicResources", {
          uri: event.value.resourceInventoriedAs,
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
```

---

## Pagination Pattern Summary

```
First request:  GET /xrpc/vf.observation.listPersons?limit=20
Response:       { records: [...20], cursor: "20" }

Next page:      GET /xrpc/vf.observation.listPersons?limit=20&cursor=20
Response:       { records: [...20], cursor: "40" }

Last page:      { records: [...5] }          ← no cursor = end of results
```

Keep all other params identical between pages. The `XrpcList.loadMore()` method handles this automatically.

---

## Environment Variables

```env
# .env
VITE_HAPPYVIEW_URL=https://your-happyview.up.railway.app
VITE_AIP_URL=https://your-aip.up.railway.app
```
