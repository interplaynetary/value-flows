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
    const body = await res.json().catch(() => ({ error: 'NetworkError' }));
    throw new XrpcError(body.error, body.message, res.status);
  }
  return res.json();
}

/** POST /xrpc/{nsid} — requires Bearer token */
export async function procedure<T>(nsid: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/xrpc/${nsid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'NetworkError' }));
    throw new XrpcError(err.error, err.message, res.status);
  }
  return res.json();
}
