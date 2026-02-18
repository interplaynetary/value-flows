#!/usr/bin/env bun
// HappyView Admin CLI
//
// Usage:
//   bun hv.ts login                            # OAuth login (opens browser, saves creds to .env)
//   bun hv.ts whoami                           # Check your auth + identity
//   bun hv.ts lexicons                         # List all registered lexicons
//   bun hv.ts lexicons upload [--backfill]     # Upload all lexicons from lexicons/
//   bun hv.ts lexicons delete <nsid>           # Delete a specific lexicon
//   bun hv.ts lexicons delete-all              # Delete all registered lexicons
//   bun hv.ts lexicons sync [--backfill]       # Delete all, then upload fresh from lexicons/
//   bun hv.ts stats                            # Record counts
//   bun hv.ts admins                           # List admins
//   bun hv.ts admins add <did>                 # Add an admin
//   bun hv.ts admins remove <id>               # Remove an admin
//   bun hv.ts backfill                         # Backfill job status
//   bun hv.ts backfill start [coll]            # Start a backfill job
//   bun hv.ts query <nsid> [--did X]           # Query records via XRPC
//   bun hv.ts query-all                        # Hit every query endpoint
//
// Reads config from .env (Bun auto-loads it).

import { SignJWT, importJWK, exportJWK, generateKeyPair } from "jose";
import { createHash, randomUUID } from "crypto";
import { Glob } from "bun";

// --- Config ---

const HAPPYVIEW_URL =
  process.env.HAPPYVIEW_URL || "https://happyview-production.up.railway.app";
const AIP_URL =
  process.env.AIP_URL || "https://aip-production-0438.up.railway.app";
const MY_DID = process.env.MY_DID || "";

let AIP_TOKEN = process.env.AIP_TOKEN || "";
let DPOP_JWK: any = null;
let privateKey: CryptoKey | null = null;
let publicJwk: { kty: "EC"; crv: "P-256"; x: string; y: string } | null = null;
let currentNonce: string | undefined;

// Try to load existing DPoP credentials
if (process.env.DPOP_JWK) {
  try {
    DPOP_JWK = JSON.parse(process.env.DPOP_JWK);
    privateKey = (await importJWK(
      { ...DPOP_JWK, kty: "EC", crv: "P-256" },
      "ES256"
    )) as CryptoKey;
    publicJwk = { kty: "EC", crv: "P-256", x: DPOP_JWK.x, y: DPOP_JWK.y };
  } catch {
    // Will prompt login
  }
}

// --- DPoP helpers ---

async function generateDpopProof(
  method: string = "GET",
  url?: string
): Promise<string> {
  if (!privateKey || !publicJwk) throw new Error("Not logged in. Run: bun hv.ts login");

  const targetUrl = url || `${AIP_URL}/oauth/userinfo`;
  const claims: Record<string, any> = {
    htm: method,
    htu: targetUrl,
  };
  if (AIP_TOKEN) {
    claims.ath = createHash("sha256").update(AIP_TOKEN).digest("base64url");
  }
  if (currentNonce) {
    claims.nonce = currentNonce;
  }

  return new SignJWT(claims)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk })
    .setJti(randomUUID())
    .setIssuedAt()
    .sign(privateKey);
}

async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!privateKey) throw new Error("Not logged in. Run: bun hv.ts login");

  let dpopProof = await generateDpopProof();
  let res = await fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `DPoP ${AIP_TOKEN}`,
      DPoP: dpopProof,
    },
  });

  // Handle nonce retry
  if (res.status === 401) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed.dpop_nonce) {
        currentNonce = parsed.dpop_nonce;
        dpopProof = await generateDpopProof();
        res = await fetch(url, {
          ...options,
          headers: {
            ...((options.headers as Record<string, string>) || {}),
            Authorization: `DPoP ${AIP_TOKEN}`,
            DPoP: dpopProof,
          },
        });
      }
    } catch {}
  }

  const newNonce = res.headers.get("dpop-nonce");
  if (newNonce) currentNonce = newNonce;

  return res;
}

// --- OAuth Login ---

function generateRandomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash("sha256").update(verifier).digest();
  return hash
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function updateEnvFile(token: string, jwk: any) {
  const envPath = `${import.meta.dir}/.env`;
  let content: string;
  try {
    content = await Bun.file(envPath).text();
  } catch {
    content = "";
  }

  const jwkStr = JSON.stringify(jwk);

  if (content.includes("AIP_TOKEN=")) {
    content = content.replace(/^AIP_TOKEN=.*$/m, `AIP_TOKEN=${token}`);
  } else {
    content += `\nAIP_TOKEN=${token}`;
  }

  if (content.includes("DPOP_JWK=")) {
    content = content.replace(/^DPOP_JWK=.*$/m, `DPOP_JWK=${jwkStr}`);
  } else {
    content += `\nDPOP_JWK=${jwkStr}`;
  }

  await Bun.write(envPath, content);
}

async function login() {
  console.log("Starting OAuth login flow...\n");

  // 1. Generate a new DPoP key pair
  const { privateKey: loginPrivKey, publicKey: loginPubKey } =
    await generateKeyPair("ES256", { extractable: true });

  const fullJwk = await exportJWK(loginPrivKey);
  const pubJwkExported = await exportJWK(loginPubKey);
  const loginPublicJwk = {
    kty: "EC" as const,
    crv: "P-256" as const,
    x: pubJwkExported.x!,
    y: pubJwkExported.y!,
  };

  // 2. Generate PKCE
  const codeVerifier = generateRandomString(32);
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateRandomString(16);

  // 3. Start local callback server
  const callbackPort = 19284;
  const redirectUri = `http://127.0.0.1:${callbackPort}/callback`;

  let resolveCode: (code: string) => void;
  const codePromise = new Promise<string>((resolve) => {
    resolveCode = resolve;
  });

  const server = Bun.serve({
    port: callbackPort,
    hostname: "127.0.0.1",
    routes: {
      "/callback": (req) => {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        if (returnedState !== state) {
          return new Response(
            "<html><body><h2>State mismatch - possible CSRF attack</h2></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        if (!code) {
          return new Response(
            "<html><body><h2>No authorization code received</h2></body></html>",
            { headers: { "Content-Type": "text/html" } }
          );
        }

        resolveCode(code);
        return new Response(
          "<html><body><h2>Login successful!</h2><p>You can close this tab and return to the terminal.</p></body></html>",
          { headers: { "Content-Type": "text/html" } }
        );
      },
    },
    fetch() {
      return new Response("Not found", { status: 404 });
    },
  });

  // 4. Register OAuth client dynamically
  console.log("Registering OAuth client with AIP...");

  const regRes = await fetch(`${AIP_URL}/oauth/clients/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
      client_name: "HappyView CLI",
    }),
  });

  if (!regRes.ok) {
    const text = await regRes.text();
    server.stop();
    console.error(`Client registration failed (${regRes.status}): ${text}`);
    process.exit(1);
  }

  const { client_id } = (await regRes.json()) as { client_id: string };
  console.log(`Client registered: ${client_id}`);

  // 5. Open browser to authorize
  const authorizeUrl = new URL(`${AIP_URL}/oauth/authorize`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", client_id);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "atproto");
  if (MY_DID) {
    authorizeUrl.searchParams.set("login_hint", MY_DID);
  }

  const authUrl = authorizeUrl.toString();
  console.log(`\nOpening browser for authorization...\n`);
  console.log(`If the browser doesn't open, visit:\n${authUrl}\n`);

  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  Bun.spawn([opener, authUrl], { stdout: "ignore", stderr: "ignore" });

  console.log("Waiting for authorization callback...");

  // 6. Wait for the callback
  const code = await codePromise;
  console.log("Authorization code received!");

  // 7. Exchange code for token (with DPoP proof)
  const tokenUrl = `${AIP_URL}/oauth/token`;
  let dpopForToken = await new SignJWT({
    htm: "POST",
    htu: tokenUrl,
  })
    .setProtectedHeader({
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: loginPublicJwk,
    })
    .setJti(randomUUID())
    .setIssuedAt()
    .sign(loginPrivKey);

  let tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      DPoP: dpopForToken,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id,
      code_verifier: codeVerifier,
    }),
  });

  // Handle nonce retry for token exchange
  if (!tokenRes.ok) {
    const nonceHeader = tokenRes.headers.get("dpop-nonce");
    const body = await tokenRes.text();
    let nonce = nonceHeader;

    if (!nonce) {
      try {
        const parsed = JSON.parse(body);
        nonce = parsed.dpop_nonce;
      } catch {}
    }

    if (nonce) {
      console.log("Retrying token exchange with DPoP nonce...");
      dpopForToken = await new SignJWT({
        htm: "POST",
        htu: tokenUrl,
        nonce,
      })
        .setProtectedHeader({
          typ: "dpop+jwt",
          alg: "ES256",
          jwk: loginPublicJwk,
        })
        .setJti(randomUUID())
        .setIssuedAt()
        .sign(loginPrivKey);

      tokenRes = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          DPoP: dpopForToken,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id,
          code_verifier: codeVerifier,
        }),
      });
    } else {
      console.error(`Token exchange failed (${tokenRes.status}): ${body}`);
      server.stop();
      process.exit(1);
    }
  }

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    console.error(`Token exchange failed (${tokenRes.status}): ${text}`);
    server.stop();
    process.exit(1);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    sub?: string;
    expires_in?: number;
  };

  server.stop();

  // 8. Save credentials to .env
  AIP_TOKEN = tokenData.access_token;
  privateKey = loginPrivKey;
  publicJwk = loginPublicJwk;
  DPOP_JWK = fullJwk;

  await updateEnvFile(tokenData.access_token, {
    crv: "P-256",
    d: fullJwk.d,
    kty: "EC",
    x: fullJwk.x,
    y: fullJwk.y,
  });

  console.log(`\nLogin successful!`);
  if (tokenData.sub) console.log(`DID: ${tokenData.sub}`);
  if (tokenData.expires_in)
    console.log(`Token expires in: ${Math.round(tokenData.expires_in / 60)} minutes`);
  console.log(`Credentials saved to .env`);
  console.log(`\nYou can now run admin commands, e.g.:`);
  console.log(`  bun hv.ts lexicons`);
  console.log(`  bun hv.ts stats`);
}

// --- Lexicon helpers ---

type LexiconEntry = {
  file: string;
  content: any;
  id: string;
  type: string;
};

async function loadAllLexicons(namespace?: string): Promise<LexiconEntry[]> {
  const pattern = namespace ? `lexicons/${namespace}/**/*.json` : "lexicons/**/*.json";
  const glob = new Glob(pattern);
  const entries: LexiconEntry[] = [];
  for await (const file of glob.scan(".")) {
    try {
      const content = await Bun.file(file).json();
      const id = content.id as string;
      const type = content.defs?.main?.type as string;
      if (id && type) entries.push({ file, content, id, type });
    } catch {
      console.warn(`  WARN skipping ${file} — invalid JSON`);
    }
  }
  return entries.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * For a query or procedure NSID, infer which record collection it targets.
 *
 * Strategy: strip a verb prefix (list/create/update/delete/get/put/patch)
 * at a camelCase boundary, then try singularization variants against the
 * known set of record NSIDs in the same namespace.
 *
 * Examples:
 *   vf.observation.listPersons  → vf.observation.person
 *   vf.observation.listProcesses → vf.observation.process  (via "ses" → "")
 *   vf.planning.createIntent    → vf.planning.intent
 */
function inferTargetCollection(nsid: string, recordNsids: Set<string>): string | null {
  const parts = nsid.split(".");
  const lastName = parts[parts.length - 1];
  const namespace = parts.slice(0, -1).join(".");

  // Strip verb prefix only at a camelCase boundary (next char must be uppercase)
  const verbPrefixes = ["list", "create", "update", "delete", "get", "put", "patch"];
  let baseName = lastName;
  for (const prefix of verbPrefixes) {
    if (baseName.startsWith(prefix) && baseName.length > prefix.length) {
      const after = baseName.slice(prefix.length);
      if (after[0] >= "A" && after[0] <= "Z") {
        baseName = after.charAt(0).toLowerCase() + after.slice(1);
        break;
      }
    }
  }

  // Try singularization variants in order of specificity
  const candidates: string[] = [baseName];
  if (baseName.endsWith("ies")) candidates.push(baseName.slice(0, -3) + "y"); // agencies → agency
  if (baseName.endsWith("ses")) candidates.push(baseName.slice(0, -2));        // processes → process
  if (baseName.endsWith("s"))   candidates.push(baseName.slice(0, -1));        // persons → person

  for (const candidate of candidates) {
    const target = `${namespace}.${candidate}`;
    if (recordNsids.has(target)) return target;
  }

  return null;
}

// --- Commands ---

async function requireAuth() {
  if (!privateKey || !AIP_TOKEN) {
    console.error("Not logged in. Run: bun hv.ts login");
    process.exit(1);
  }
}

async function cmdWhoami() {
  await requireAuth();
  console.log("Checking auth...\n");

  const res = await authFetch(`${HAPPYVIEW_URL}/admin/admins`);
  if (res.ok) {
    const admins = await res.json();
    console.log("Authenticated as admin");
    console.log(`DID: ${MY_DID || "(check .env)"}`);
    console.log(`HappyView: ${HAPPYVIEW_URL}`);
    console.log(`AIP: ${AIP_URL}`);
    console.log(`\nAdmins (${admins.length}):`);
    for (const a of admins) {
      console.log(`  ${a.did}${a.did === MY_DID ? " (you)" : ""}`);
    }
  } else {
    console.log(`Auth failed: ${res.status} ${await res.text()}`);
  }
}

async function cmdStats() {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/stats`);
  if (!res.ok) return console.error(`Error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  console.log(`Total records: ${data.total_records}\n`);
  if (data.collections?.length) {
    for (const c of data.collections) {
      console.log(`  ${c.collection}: ${c.count}`);
    }
  } else {
    console.log("  (no records yet)");
  }
}

async function cmdLexicons() {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons`);
  if (!res.ok) return console.error(`Error: ${res.status} ${await res.text()}`);
  const lexicons = await res.json();

  const records = lexicons.filter((l: any) => l.lexicon_type === "record");
  const queries = lexicons.filter((l: any) => l.lexicon_type === "query");
  const procedures = lexicons.filter((l: any) => l.lexicon_type === "procedure");
  const definitions = lexicons.filter((l: any) => l.lexicon_type === "definitions");

  console.log(`Records (${records.length}):`);
  for (const l of records) console.log(`  ${l.id}`);

  console.log(`\nQueries (${queries.length}):`);
  for (const l of queries) console.log(`  GET  /xrpc/${l.id}`);

  console.log(`\nProcedures (${procedures.length}):`);
  for (const l of procedures) console.log(`  POST /xrpc/${l.id}`);

  if (definitions.length) {
    console.log(`\nDefinitions (${definitions.length}):`);
    for (const l of definitions) console.log(`  ${l.id}`);
  }

  console.log(`\nTotal: ${lexicons.length} lexicons`);
}

async function cmdLexiconsUpload(opts: { backfill?: boolean; only?: string } = {}) {
  await requireAuth();

  const all = await loadAllLexicons(opts.only);
  const records = all.filter((e) => e.type === "record");
  const nonRecords = all.filter((e) => e.type !== "record");
  const recordNsids = new Set(records.map((e) => e.id));

  let uploaded = 0, skipped = 0, failed = 0;

  const uploadOne = async (entry: LexiconEntry, targetCollection?: string | null) => {
    const body: any = {
      lexicon_json: entry.content,
      backfill: opts.backfill ?? false,
    };
    if (targetCollection) body.target_collection = targetCollection;

    const res = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const suffix = targetCollection ? ` -> ${targetCollection}` : "";
      console.log(`  OK   ${entry.id} (${entry.type})${suffix} [rev ${data.revision}]`);
      uploaded++;
    } else {
      console.log(`  FAIL ${entry.id} — ${res.status}: ${await res.text()}`);
      failed++;
    }
  };

  // Upload records first (they create the Jetstream subscriptions)
  console.log(`\nUploading ${records.length} record lexicons...`);
  for (const entry of records) {
    await uploadOne(entry);
  }

  // Upload queries, procedures, and definitions
  console.log(`\nUploading ${nonRecords.length} query/procedure/definition lexicons...`);
  for (const entry of nonRecords) {
    if (entry.type === "query" || entry.type === "procedure") {
      const target = inferTargetCollection(entry.id, recordNsids);
      if (!target) {
        console.log(`  SKIP ${entry.id} (${entry.type}) — could not infer target_collection`);
        skipped++;
        continue;
      }
      await uploadOne(entry, target);
    } else {
      // definitions and anything else — no target_collection needed
      await uploadOne(entry);
    }
  }

  console.log(`\nDone: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
}

async function cmdLexiconsDeleteAll() {
  await requireAuth();

  const res = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons`);
  if (!res.ok) return console.error(`Error listing lexicons: ${res.status} ${await res.text()}`);

  const lexicons = (await res.json()) as Array<{ id: string }>;
  if (lexicons.length === 0) {
    console.log("No lexicons to delete.");
    return;
  }

  console.log(`Deleting ${lexicons.length} lexicons...`);
  let deleted = 0, failed = 0;

  for (const { id } of lexicons) {
    const delRes = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons/${id}`, {
      method: "DELETE",
    });
    if (delRes.status === 204) {
      console.log(`  DEL  ${id}`);
      deleted++;
    } else {
      console.log(`  FAIL ${id} — ${delRes.status}: ${await delRes.text()}`);
      failed++;
    }
  }

  console.log(`\nDone: ${deleted} deleted, ${failed} failed`);
}

async function cmdLexiconsSync(opts: { backfill?: boolean; only?: string } = {}) {
  await requireAuth();
  console.log("=== Sync: delete all existing lexicons, then upload fresh ===\n");
  await cmdLexiconsDeleteAll();
  console.log();
  await cmdLexiconsUpload(opts);
}

async function cmdLexiconDelete(nsid: string) {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons/${nsid}`, {
    method: "DELETE",
  });
  if (res.status === 204) {
    console.log(`Deleted: ${nsid}`);
  } else {
    console.error(`Error: ${res.status} ${await res.text()}`);
  }
}

async function cmdAdmins() {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/admins`);
  if (!res.ok) return console.error(`Error: ${res.status} ${await res.text()}`);
  const admins = await res.json();
  console.log(`Admins (${admins.length}):\n`);
  for (const a of admins) {
    const lastUsed = a.last_used_at
      ? new Date(a.last_used_at).toLocaleString()
      : "never";
    console.log(`  ${a.did}`);
    console.log(`    id: ${a.id}  |  last active: ${lastUsed}`);
  }
}

async function cmdAdminsAdd(did: string) {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ did }),
  });
  if (res.ok) {
    const data = await res.json();
    console.log(`Added admin: ${data.did} (id: ${data.id})`);
  } else {
    console.error(`Error: ${res.status} ${await res.text()}`);
  }
}

async function cmdAdminsRemove(id: string) {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/admins/${id}`, {
    method: "DELETE",
  });
  if (res.status === 204) {
    console.log(`Removed admin: ${id}`);
  } else {
    console.error(`Error: ${res.status} ${await res.text()}`);
  }
}

async function cmdBackfill() {
  await requireAuth();
  const res = await authFetch(`${HAPPYVIEW_URL}/admin/backfill/status`);
  if (!res.ok) return console.error(`Error: ${res.status} ${await res.text()}`);
  const jobs = await res.json();
  if (jobs.length === 0) return console.log("No backfill jobs");
  for (const j of jobs) {
    const status = j.status.toUpperCase().padEnd(10);
    const coll = j.collection ?? "all";
    console.log(
      `  [${status}] ${coll} — ${j.processed_repos}/${j.total_repos} repos, ${j.total_records} records`
    );
    if (j.error) console.log(`    error: ${j.error}`);
  }
}

async function cmdBackfillStart(collection?: string) {
  await requireAuth();
  const body: any = {};
  if (collection) body.collection = collection;

  const res = await authFetch(`${HAPPYVIEW_URL}/admin/backfill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    const data = await res.json();
    console.log(`Backfill started: ${data.id} (${data.status})`);
  } else {
    console.error(`Error: ${res.status} ${await res.text()}`);
  }
}

async function cmdQuery(nsid: string, opts: { did?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.did) params.set("did", opts.did);

  const url = `${HAPPYVIEW_URL}/xrpc/${nsid}?${params}`;
  console.log(`GET ${url}\n`);

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`Error: ${res.status} ${await res.text()}`);
    return;
  }
  const data = await res.json();
  const count = data.records?.length ?? 0;
  console.log(`${count} record(s)`);
  if (count > 0) {
    console.log(JSON.stringify(data.records, null, 2));
  }
  if (data.cursor) console.log(`\ncursor: ${data.cursor} (more available)`);
}

async function cmdQueryAll() {
  await requireAuth();
  console.log("Querying all XRPC query endpoints...\n");

  const res = await authFetch(`${HAPPYVIEW_URL}/admin/lexicons`);
  if (!res.ok) return console.error(`Error listing lexicons: ${res.status}`);

  const lexicons = (await res.json()) as Array<{ id: string; lexicon_type: string }>;
  const queries = lexicons.filter((l) => l.lexicon_type === "query");

  if (queries.length === 0) {
    console.log("No query lexicons registered.");
    return;
  }

  for (const { id } of queries) {
    const qres = await fetch(`${HAPPYVIEW_URL}/xrpc/${id}?limit=1`);
    if (qres.ok) {
      const data = await qres.json();
      const count = data.records?.length ?? 0;
      const more = data.cursor ? " (more)" : "";
      console.log(`  ${id}: ${count} record(s)${more}`);
    } else {
      console.log(`  ${id}: ${qres.status} ${await qres.text()}`);
    }
  }
}

// --- CLI Router ---

const [cmd, subcmd, ...rest] = process.argv.slice(2);

function usage() {
  console.log(`HappyView Admin CLI

Usage: bun hv.ts <command> [options]

Commands:
  login                              OAuth login (opens browser, saves creds to .env)
  whoami                             Check your auth and identity

  lexicons                           List all registered lexicons
  lexicons upload [--backfill]       Upload all lexicons from lexicons/
  lexicons delete <nsid>             Delete a specific lexicon
  lexicons delete-all                Delete all registered lexicons
  lexicons sync [--backfill]         Delete all, then upload fresh from lexicons/

  stats                              Record counts by collection
  admins                             List admins
  admins add <did>                   Add an admin
  admins remove <id>                 Remove an admin by UUID
  backfill                           Backfill job status
  backfill start [coll]              Start backfill (optionally for one collection)
  query <nsid> [--did X] [--limit N] Query records (unauthenticated)
  query-all                          Hit every registered query endpoint

Flags:
  --backfill   Trigger historical backfill when uploading record lexicons

Config:
  Reads from .env (auto-loaded by Bun). Run 'bun hv.ts login' to populate.
  Current: ${HAPPYVIEW_URL}`);
}

switch (cmd) {
  case "login":
    await login();
    break;
  case "whoami":
    await cmdWhoami();
    break;
  case "stats":
    await cmdStats();
    break;
  case "lexicons":
    if (!subcmd) {
      await cmdLexicons();
    } else if (subcmd === "upload") {
      const onlyIdx = rest.indexOf("--only");
      await cmdLexiconsUpload({ backfill: rest.includes("--backfill"), only: onlyIdx >= 0 ? rest[onlyIdx + 1] : undefined });
    } else if (subcmd === "delete" && rest[0]) {
      await cmdLexiconDelete(rest[0]);
    } else if (subcmd === "delete-all") {
      await cmdLexiconsDeleteAll();
    } else if (subcmd === "sync") {
      const onlyIdx = rest.indexOf("--only");
      await cmdLexiconsSync({ backfill: rest.includes("--backfill"), only: onlyIdx >= 0 ? rest[onlyIdx + 1] : undefined });
    } else {
      console.error(`Unknown: lexicons ${subcmd}`);
      usage();
    }
    break;
  case "admins":
    if (subcmd === "add" && rest[0]) await cmdAdminsAdd(rest[0]);
    else if (subcmd === "remove" && rest[0]) await cmdAdminsRemove(rest[0]);
    else if (!subcmd) await cmdAdmins();
    else {
      console.error(`Unknown: admins ${subcmd}`);
      usage();
    }
    break;
  case "backfill":
    if (subcmd === "start") await cmdBackfillStart(rest[0]);
    else if (!subcmd) await cmdBackfill();
    else {
      console.error(`Unknown: backfill ${subcmd}`)
      usage();
    }
    break;
  case "query":
    if (subcmd) {
      const didIdx = rest.indexOf("--did");
      const did = didIdx >= 0 ? rest[didIdx + 1] : undefined;
      const limitIdx = rest.indexOf("--limit");
      const limit = limitIdx >= 0 ? parseInt(rest[limitIdx + 1]) : 20;
      await cmdQuery(subcmd, { did, limit });
    } else {
      console.error("Usage: bun hv.ts query <nsid> [--did X] [--limit N]");
    }
    break;
  case "query-all":
    await cmdQueryAll();
    break;
  default:
    usage();
    break;
}
