// tests/xrpc.ts
// Comprehensive XRPC integration test suite for HappyView
//
// Run:
//   bun test tests/xrpc.ts                                  # all tests
//   bun test tests/xrpc.ts --test-name-pattern "health"     # single suite
//
// Reads credentials from .env (auto-loaded by Bun).
// Unauthenticated tests always run; auth-gated tests are skipped when
// AIP_TOKEN and DPOP_JWK are absent.

import { describe, test, expect, beforeAll } from "bun:test";
import { SignJWT, importJWK } from "jose";
import { createHash, randomUUID } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL =
  process.env.HAPPYVIEW_URL || "https://happyview-production.up.railway.app";
const AIP_URL =
  process.env.AIP_URL || "https://aip-production-0438.up.railway.app";
const NS = process.env.NSID || "org.openassociation";
const TOKEN = process.env.AIP_TOKEN || "";
const DPOP_JWK_STR = process.env.DPOP_JWK || "";
const hasAuth = !!(TOKEN && DPOP_JWK_STR);

// ─── DPoP Auth ───────────────────────────────────────────────────────────────

let privateKey: CryptoKey | null = null;
let publicJwk: { kty: "EC"; crv: "P-256"; x: string; y: string } | null = null;
let currentNonce: string | undefined;

if (hasAuth) {
  const dpopJwk = JSON.parse(DPOP_JWK_STR);
  privateKey = (await importJWK(
    { ...dpopJwk, kty: "EC", crv: "P-256" },
    "ES256"
  )) as CryptoKey;
  publicJwk = { kty: "EC", crv: "P-256", x: dpopJwk.x, y: dpopJwk.y };
}

async function dpopProof(): Promise<string> {
  const ath = createHash("sha256").update(TOKEN).digest("base64url");
  return new SignJWT({
    htm: "GET",
    htu: `${AIP_URL}/oauth/userinfo`,
    ath,
    ...(currentNonce ? { nonce: currentNonce } : {}),
  })
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: publicJwk! })
    .setJti(randomUUID())
    .setIssuedAt()
    .sign(privateKey!);
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!privateKey) return fetch(url, options);

  let proof = await dpopProof();
  let res = await fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `DPoP ${TOKEN}`,
      DPoP: proof,
    },
  });

  if (res.status === 401) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed.dpop_nonce) {
        currentNonce = parsed.dpop_nonce;
        proof = await dpopProof();
        res = await fetch(url, {
          ...options,
          headers: {
            ...((options.headers as Record<string, string>) || {}),
            Authorization: `DPoP ${TOKEN}`,
            DPoP: proof,
          },
        });
      }
    } catch {}
  }

  const nonce = res.headers.get("dpop-nonce");
  if (nonce) currentNonce = nonce;
  return res;
}

// ─── Known lexicons ───────────────────────────────────────────────────────────
// These reflect what is uploaded from lexicons/${NS}/ via `bun hv.ts lexicons sync`

const EXPECTED_RECORDS = [
  `${NS}.knowledge.action`,
  `${NS}.knowledge.processSpecification`,
  `${NS}.knowledge.recipe`,
  `${NS}.knowledge.recipeExchange`,
  `${NS}.knowledge.recipeFlow`,
  `${NS}.knowledge.recipeProcess`,
  `${NS}.knowledge.resourceSpecification`,
  `${NS}.knowledge.spatialThing`,
  `${NS}.knowledge.unit`,
  `${NS}.observation.agent`,
  `${NS}.observation.batchLotRecord`,
  `${NS}.observation.ecologicalAgent`,
  `${NS}.observation.economicEvent`,
  `${NS}.observation.economicResource`,
  `${NS}.observation.organization`,
  `${NS}.observation.person`,
  `${NS}.planning.agreement`,
  `${NS}.planning.agreementBundle`,
  `${NS}.planning.claim`,
  `${NS}.planning.commitment`,
  `${NS}.planning.intent`,
  `${NS}.planning.plan`,
  `${NS}.planning.process`,
  `${NS}.planning.proposal`,
  `${NS}.planning.proposalList`,
];

const QUERY_ENDPOINTS = [
  // Knowledge
  { nsid: `${NS}.knowledge.listActions`,                collection: `${NS}.knowledge.action` },
  { nsid: `${NS}.knowledge.listProcessSpecifications`,  collection: `${NS}.knowledge.processSpecification` },
  { nsid: `${NS}.knowledge.listRecipeExchanges`,        collection: `${NS}.knowledge.recipeExchange` },
  { nsid: `${NS}.knowledge.listRecipeFlows`,            collection: `${NS}.knowledge.recipeFlow` },
  { nsid: `${NS}.knowledge.listRecipeProcesses`,        collection: `${NS}.knowledge.recipeProcess` },
  { nsid: `${NS}.knowledge.listRecipes`,                collection: `${NS}.knowledge.recipe` },
  { nsid: `${NS}.knowledge.listResourceSpecifications`, collection: `${NS}.knowledge.resourceSpecification` },
  { nsid: `${NS}.knowledge.listSpatialThings`,          collection: `${NS}.knowledge.spatialThing` },
  { nsid: `${NS}.knowledge.listUnits`,                  collection: `${NS}.knowledge.unit` },
  // Observation
  { nsid: `${NS}.observation.listAgents`,               collection: `${NS}.observation.agent` },
  { nsid: `${NS}.observation.listBatchLotRecords`,      collection: `${NS}.observation.batchLotRecord` },
  { nsid: `${NS}.observation.listEcologicalAgents`,     collection: `${NS}.observation.ecologicalAgent` },
  { nsid: `${NS}.observation.listEconomicEvents`,       collection: `${NS}.observation.economicEvent` },
  { nsid: `${NS}.observation.listEconomicResources`,    collection: `${NS}.observation.economicResource` },
  { nsid: `${NS}.observation.listOrganizations`,        collection: `${NS}.observation.organization` },
  { nsid: `${NS}.observation.listPersons`,              collection: `${NS}.observation.person` },
  // Planning
  { nsid: `${NS}.planning.listAgreementBundles`,        collection: `${NS}.planning.agreementBundle` },
  { nsid: `${NS}.planning.listAgreements`,              collection: `${NS}.planning.agreement` },
  { nsid: `${NS}.planning.listClaims`,                  collection: `${NS}.planning.claim` },
  { nsid: `${NS}.planning.listCommitments`,             collection: `${NS}.planning.commitment` },
  { nsid: `${NS}.planning.listIntents`,                 collection: `${NS}.planning.intent` },
  { nsid: `${NS}.planning.listPlans`,                   collection: `${NS}.planning.plan` },
  { nsid: `${NS}.planning.listProcesses`,               collection: `${NS}.planning.process` },
  { nsid: `${NS}.planning.listProposalLists`,           collection: `${NS}.planning.proposalList` },
  { nsid: `${NS}.planning.listProposals`,               collection: `${NS}.planning.proposal` },
];

// Shared state populated in beforeAll
let registeredLexicons: Array<{ id: string; lexicon_type: string; target_collection?: string }> = [];

// ─── 1. Health ────────────────────────────────────────────────────────────────

describe("health", () => {
  test("GET /health returns 200 ok", async () => {
    const res = await fetch(`${BASE_URL}/health`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });
});

// ─── 2. Admin API ─────────────────────────────────────────────────────────────

describe("admin API", () => {
  beforeAll(async () => {
    if (!hasAuth) return;
    const res = await authFetch(`${BASE_URL}/admin/lexicons`);
    if (res.ok) registeredLexicons = await res.json();
  });

  test.if(hasAuth)("GET /admin/lexicons returns array", async () => {
    const res = await authFetch(`${BASE_URL}/admin/lexicons`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test.if(hasAuth)("all expected record lexicons are registered", () => {
    const ids = new Set(registeredLexicons.map((l) => l.id));
    for (const id of EXPECTED_RECORDS) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test.if(hasAuth)("all expected query lexicons are registered", () => {
    const ids = new Set(registeredLexicons.map((l) => l.id));
    for (const { nsid } of QUERY_ENDPOINTS) {
      expect(ids.has(nsid)).toBe(true);
    }
  });

  test.if(hasAuth)("query lexicons have target_collection set", () => {
    const queries = registeredLexicons.filter((l) => l.lexicon_type === "query");
    expect(queries.length).toBe(QUERY_ENDPOINTS.length);
    for (const q of queries) {
      expect(typeof q.target_collection).toBe("string");
      expect(q.target_collection!.length).toBeGreaterThan(0);
    }
  });

  test.if(hasAuth)("each query target_collection matches a registered record", () => {
    const recordIds = new Set(
      registeredLexicons.filter((l) => l.lexicon_type === "record").map((l) => l.id)
    );
    const queries = registeredLexicons.filter((l) => l.lexicon_type === "query");
    for (const q of queries) {
      expect(recordIds.has(q.target_collection!)).toBe(true);
    }
  });

  test.if(hasAuth)("GET /admin/stats returns record counts", async () => {
    const res = await authFetch(`${BASE_URL}/admin/stats`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.total_records).toBe("number");
    expect(data.total_records).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(data.collections)).toBe(true);
  });

  test.if(hasAuth)("GET /admin/backfill/status returns array", async () => {
    const res = await authFetch(`${BASE_URL}/admin/backfill/status`);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test.if(hasAuth)("GET /admin/admins has at least one admin", async () => {
    const res = await authFetch(`${BASE_URL}/admin/admins`);
    expect(res.status).toBe(200);
    const admins = await res.json();
    expect(Array.isArray(admins)).toBe(true);
    expect(admins.length).toBeGreaterThan(0);
    expect(typeof admins[0].did).toBe("string");
    expect(admins[0].did).toMatch(/^did:/);
  });

  test("GET /admin/lexicons without auth returns 4xx", async () => {
    const res = await fetch(`${BASE_URL}/admin/lexicons`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

// ─── 3. XRPC Query Endpoints ─────────────────────────────────────────────────

describe("XRPC query endpoints — shape", () => {
  test.each(QUERY_ENDPOINTS)(
    "GET /xrpc/$nsid returns valid list shape",
    async ({ nsid }) => {
      const res = await fetch(`${BASE_URL}/xrpc/${nsid}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("application/json");

      const data = await res.json();
      expect(data).toHaveProperty("records");
      expect(Array.isArray(data.records)).toBe(true);
    }
  );

  test.each(QUERY_ENDPOINTS)(
    "GET /xrpc/$nsid records each have a valid AT-URI",
    async ({ nsid }) => {
      const res = await fetch(`${BASE_URL}/xrpc/${nsid}?limit=5`);
      expect(res.status).toBe(200);
      const data = await res.json();

      for (const record of data.records) {
        expect(typeof record.uri).toBe("string");
        expect(record.uri).toMatch(/^at:\/\//);
      }
    }
  );

  test.each(QUERY_ENDPOINTS)(
    "GET /xrpc/$nsid cursor is string when present",
    async ({ nsid }) => {
      const res = await fetch(`${BASE_URL}/xrpc/${nsid}?limit=1`);
      const data = await res.json();

      if ("cursor" in data) {
        expect(typeof data.cursor).toBe("string");
      }
    }
  );
});

// ─── 4. Query Parameters ─────────────────────────────────────────────────────

describe("query parameters", () => {
  // Use a small collection that's likely to have entries
  const testNsid = `${NS}.knowledge.listUnits`;

  test("limit=1 returns at most 1 record", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${testNsid}?limit=1`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records.length).toBeLessThanOrEqual(1);
  });

  test("limit=100 (max) is accepted", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${testNsid}?limit=100`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.records)).toBe(true);
    expect(data.records.length).toBeLessThanOrEqual(100);
  });

  test("cursor=0 (initial cursor) is accepted", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${testNsid}?cursor=0`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.records)).toBe(true);
  });

  test("cursor pagination returns different pages", async () => {
    const page1 = await fetch(`${BASE_URL}/xrpc/${testNsid}?limit=1`).then((r) =>
      r.json()
    );
    if (!page1.cursor || page1.records.length === 0) return; // not enough data

    const page2 = await fetch(
      `${BASE_URL}/xrpc/${testNsid}?limit=1&cursor=${page1.cursor}`
    ).then((r) => r.json());

    expect(Array.isArray(page2.records)).toBe(true);
    if (page2.records.length > 0) {
      expect(page2.records[0].uri).not.toBe(page1.records[0].uri);
    }
  });

  test("did filter with nonexistent DID returns empty records", async () => {
    const fakeDid = "did:plc:doesnotexist00000000000";
    const res = await fetch(
      `${BASE_URL}/xrpc/${testNsid}?did=${encodeURIComponent(fakeDid)}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.records.length).toBe(0);
  });

  test("did filter accepts valid DID format", async () => {
    const did = "did:plc:abc123";
    const res = await fetch(`${BASE_URL}/xrpc/${testNsid}?did=${encodeURIComponent(did)}`);
    expect(res.status).toBe(200);
  });

  test("uri param fetches a single record by AT-URI", async () => {
    // Discover a live URI from the list first
    const listRes = await fetch(`${BASE_URL}/xrpc/${testNsid}?limit=1`);
    const listData = await listRes.json();
    if (listData.records.length === 0) return; // no data yet — skip

    const uri = listData.records[0].uri;
    const res = await fetch(
      `${BASE_URL}/xrpc/${testNsid}?uri=${encodeURIComponent(uri)}`
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("record");
    expect(data.record.uri).toBe(uri);
  });

  // Repeat uri/did tests for each sub-NSID's primary endpoint
  test("observation.listPersons: uri fetch works", async () => {
    const nsid = `${NS}.observation.listPersons`;
    const list = await fetch(`${BASE_URL}/xrpc/${nsid}?limit=1`).then((r) => r.json());
    if (list.records.length === 0) return;

    const uri = list.records[0].uri;
    const res = await fetch(`${BASE_URL}/xrpc/${nsid}?uri=${encodeURIComponent(uri)}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.record.uri).toBe(uri);
  });

  test("observation.listEconomicEvents: uri fetch works", async () => {
    const nsid = `${NS}.observation.listEconomicEvents`;
    const list = await fetch(`${BASE_URL}/xrpc/${nsid}?limit=1`).then((r) => r.json());
    if (list.records.length === 0) return;

    const uri = list.records[0].uri;
    const res = await fetch(`${BASE_URL}/xrpc/${nsid}?uri=${encodeURIComponent(uri)}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.record.uri).toBe(uri);
  });

  test("planning.listIntents: uri fetch works", async () => {
    const nsid = `${NS}.planning.listIntents`;
    const list = await fetch(`${BASE_URL}/xrpc/${nsid}?limit=1`).then((r) => r.json());
    if (list.records.length === 0) return;

    const uri = list.records[0].uri;
    const res = await fetch(`${BASE_URL}/xrpc/${nsid}?uri=${encodeURIComponent(uri)}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.record.uri).toBe(uri);
  });
});

// ─── 5. Record Schema Spot-checks ────────────────────────────────────────────
// When records exist, verify field types match the lexicon schema.

describe("record schema validation", () => {
  test("knowledge.action records have required actionId and label", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.knowledge.listActions?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      if (record.value) {
        expect(typeof record.value.actionId).toBe("string");
        expect(typeof record.value.label).toBe("string");
      }
    }
  });

  test("knowledge.unit records have required label", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.knowledge.listUnits?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      if (record.value) {
        expect(typeof record.value.label).toBe("string");
      }
    }
  });

  test("observation.economicEvent records have required action field", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.observation.listEconomicEvents?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      if (record.value) {
        expect(typeof record.value.action).toBe("string");
        expect(record.value.action).toMatch(/^at:\/\//);
      }
    }
  });

  test("planning.commitment records have required action field", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.planning.listCommitments?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      if (record.value) {
        expect(typeof record.value.action).toBe("string");
        expect(record.value.action).toMatch(/^at:\/\//);
      }
    }
  });

  test("planning.intent records have required action field", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.planning.listIntents?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      if (record.value) {
        expect(typeof record.value.action).toBe("string");
        expect(record.value.action).toMatch(/^at:\/\//);
      }
    }
  });

  test("observation.agent records have valid type enum value", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.observation.listAgents?limit=10`);
    const data = await res.json();
    const validTypes = ["person", "organization", "ecologicalAgent"];
    for (const record of data.records) {
      if (record.value?.type) {
        expect(validTypes).toContain(record.value.type);
      }
    }
  });

  test("observation.economicResource accountingQuantity is a Measure object", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.observation.listEconomicResources?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      const aq = record.value?.accountingQuantity;
      if (aq) {
        expect(typeof aq.hasNumericalValue).toBe("number");
        if (aq.hasUnit) expect(aq.hasUnit).toMatch(/^at:\/\//);
      }
    }
  });

  test("planning.agreement stipulates is an array of AT-URIs", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/${NS}.planning.listAgreements?limit=10`);
    const data = await res.json();
    for (const record of data.records) {
      const stipulates = record.value?.stipulates;
      if (stipulates) {
        expect(Array.isArray(stipulates)).toBe(true);
        for (const uri of stipulates) {
          expect(typeof uri).toBe("string");
          expect(uri).toMatch(/^at:\/\//);
        }
      }
    }
  });
});

// ─── 6. Error Handling ───────────────────────────────────────────────────────

describe("error handling", () => {
  test("unknown XRPC endpoint returns 4xx", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/does.not.exist`);
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  test("GET on a non-existent subpath of known endpoint returns 4xx", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/vf.knowledge.listUnits/bogus`);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("POST to a query endpoint (wrong method) is rejected", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/vf.knowledge.listUnits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test("procedure endpoint without auth returns 401/403", async () => {
    // If procedure endpoints exist, they should require auth
    const res = await fetch(`${BASE_URL}/xrpc/vf.knowledge.createUnit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "test" }),
    });
    // Either not found (no procedure registered) or unauthorized
    expect([401, 403, 404, 405]).toContain(res.status);
  });

  test("limit=0 is handled gracefully", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/vf.knowledge.listUnits?limit=0`);
    // Either clamped to default or returns an error
    expect([200, 400, 422]).toContain(res.status);
  });

  test("limit above max is handled gracefully", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/vf.knowledge.listUnits?limit=9999`);
    expect([200, 400, 422]).toContain(res.status);
    if (res.status === 200) {
      const data = await res.json();
      // Should be clamped to max (100 per the API spec)
      expect(data.records.length).toBeLessThanOrEqual(100);
    }
  });
});

// ─── 7. Fixed XRPC Endpoints ─────────────────────────────────────────────────

describe("fixed XRPC endpoints", () => {
  test.if(hasAuth)("GET /xrpc/app.bsky.actor.getProfile returns profile", async () => {
    const res = await authFetch(`${BASE_URL}/xrpc/app.bsky.actor.getProfile`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.did).toBe("string");
    expect(data.did).toMatch(/^did:/);
    expect(typeof data.handle).toBe("string");
  });

  test("GET /xrpc/app.bsky.actor.getProfile without auth returns 401/403", async () => {
    const res = await fetch(`${BASE_URL}/xrpc/app.bsky.actor.getProfile`);
    expect([401, 403]).toContain(res.status);
  });
});

// ─── 8. CRUD Lifecycle ───────────────────────────────────────────────────────
// These tests cover the full create → read → update flow through procedure endpoints.
// They require:
//   1. AIP_TOKEN and DPOP_JWK to be set
//   2. Procedure lexicons to be uploaded (bun hv.ts lexicons upload)
//
// To add procedure lexicons: create lexicons/vf/knowledge/createUnit.json etc.
// and run `bun hv.ts lexicons sync --only vf`

describe("CRUD lifecycle — vf.knowledge.unit", () => {
  test.todo("POST /xrpc/vf.knowledge.createUnit creates a unit record");
  test.todo("created unit appears in GET /xrpc/vf.knowledge.listUnits");
  test.todo("GET /xrpc/vf.knowledge.listUnits?uri=<at-uri> returns the unit");
  test.todo("POST /xrpc/vf.knowledge.createUnit with uri updates the record");
  test.todo("updated unit reflects new field values in list");
});

describe("CRUD lifecycle — vf.knowledge.action", () => {
  test.todo("POST /xrpc/vf.knowledge.createAction creates an action");
  test.todo("action actionId matches one of the known knownValues");
  test.todo("action appears in GET /xrpc/vf.knowledge.listActions");
});

describe("CRUD lifecycle — vf.observation.person", () => {
  test.todo("POST /xrpc/vf.observation.createPerson creates a person");
  test.todo("person appears in GET /xrpc/vf.observation.listPersons");
  test.todo("person also appears in GET /xrpc/vf.observation.listAgents");
  test.todo("GET /xrpc/vf.observation.listPersons?did=<creator> filters correctly");
});

describe("CRUD lifecycle — vf.observation.economicEvent", () => {
  test.todo("POST /xrpc/vf.observation.createEconomicEvent creates an event");
  test.todo("event action field is a valid AT-URI to a vf.knowledge.action record");
  test.todo("event fulfills array links to commitment AT-URIs");
  test.todo("event satisfies array links to intent AT-URIs");
});

describe("CRUD lifecycle — vf.planning.intent", () => {
  test.todo("POST /xrpc/vf.planning.createIntent creates an intent");
  test.todo("intent action field is a valid AT-URI");
  test.todo("intent appears in GET /xrpc/vf.planning.listIntents");
});

describe("CRUD lifecycle — vf.planning.commitment", () => {
  test.todo("POST /xrpc/vf.planning.createCommitment creates a commitment");
  test.todo("commitment satisfies array references existing intents");
  test.todo("commitment appears in GET /xrpc/vf.planning.listCommitments");
});

describe("CRUD lifecycle — vf.planning.process", () => {
  test.todo("POST /xrpc/vf.planning.createProcess creates a process");
  test.todo("process hasInput and hasOutput are arrays of AT-URIs");
  test.todo("process appears in GET /xrpc/vf.planning.listProcesses");
});

describe("CRUD lifecycle — vf.planning.agreement", () => {
  test.todo("POST /xrpc/vf.planning.createAgreement creates an agreement");
  test.todo("agreement stipulates references commitment AT-URIs");
  test.todo("agreement appears in GET /xrpc/vf.planning.listAgreements");
});
