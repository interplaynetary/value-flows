// src/lib/stores/xrpc-list.svelte.ts
import { query } from '$lib/xrpc.svelte';

export interface ListResponse<T> {
  records: T[];
  cursor?: string;
}

export class XrpcList<T> {
  records = $state<T[]>([]);
  cursor = $state<string | undefined>(undefined);
  loading = $state(false);
  error = $state<string | null>(null);

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
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : String(e);
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
    } catch (e: unknown) {
      this.error = e instanceof Error ? e.message : String(e);
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
