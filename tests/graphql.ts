/**
 * Quickslice GraphQL API Tests
 *
 * Tests the Quickslice GraphQL endpoint for a org.openassociation ValueFlows instance.
 * Covers: Relay connections, built-in fields, filtering, sorting, pagination,
 *         forward joins, reverse joins, DID joins, aggregations, viewer state,
 *         and authenticated mutations.
 *
 * Usage:
 *   bun test ./tests/graphql.ts
 *
 * Env:
 *   QUICKSLICE_URL      — base URL of the Quickslice instance (required)
 *   QUICKSLICE_TOKEN    — access token for auth tests (optional)
 *   QUICKSLICE_DPOP_JWK — DPoP private key JWK paired with the token (optional)
 *   NAMESPACE           — lexicon namespace prefix (default: org.openassociation)
 *
 * ─── Auth Setup ───────────────────────────────────────────────────────────────
 * Run the login helper once to obtain a token and DPoP key:
 *   bun scripts/qs-login.ts
 *
 * This opens a browser OAuth flow and saves QUICKSLICE_TOKEN + QUICKSLICE_DPOP_JWK
 * to .env automatically. Tokens expire — re-run qs-login.ts to refresh.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { SignJWT, importJWK } from "jose";
import { createHash } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const QUICKSLICE_URL = process.env.QUICKSLICE_URL ?? "http://localhost:3000";
const TOKEN         = process.env.QUICKSLICE_TOKEN?.trim() || null;
const NS            = process.env.NAMESPACE ?? "org.openassociation";
const hasAuth       = !!TOKEN;

// ── DPoP ─────────────────────────────────────────────────────────────────────
// Public OAuth clients (like ours) use DPoP-bound tokens.
// Each request needs a fresh DPoP proof JWT signed with the same key used at login.

let dpopPrivateKey: CryptoKey | null = null;
let dpopPublicJwk: Record<string, string> | null = null;
let dpopNonce: string | null = null;

if (process.env.QUICKSLICE_DPOP_JWK) {
  try {
    const jwk = JSON.parse(process.env.QUICKSLICE_DPOP_JWK);
    dpopPrivateKey = (await importJWK(jwk, "ES256")) as CryptoKey;
    const { d: _d, ...pub } = jwk;
    dpopPublicJwk = pub;
  } catch (e) {
    console.warn("⚠  Failed to parse QUICKSLICE_DPOP_JWK:", e);
  }
}

async function makeDPoPProof(method: string, url: string): Promise<string> {
  if (!dpopPrivateKey || !dpopPublicJwk) throw new Error("No DPoP key loaded");
  const claims: Record<string, string> = { htm: method, htu: url };
  if (TOKEN) {
    claims.ath = createHash("sha256").update(TOKEN).digest("base64url");
  }
  if (dpopNonce) claims.nonce = dpopNonce;
  return new SignJWT(claims)
    .setProtectedHeader({ typ: "dpop+jwt", alg: "ES256", jwk: dpopPublicJwk })
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .sign(dpopPrivateKey);
}

// ── Name helpers ──────────────────────────────────────────────────────────────
// Derive Quickslice GraphQL field/type names from NSIDs.
//
//   org.openassociation.observation.economicEvent
//     → field: orgOpenassociationObservationEconomicEvent
//     → type:  OrgOpenassociationObservationEconomicEvent

function nsidToField(nsid: string): string {
  return nsid
    .split(".")
    .map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1)))
    .join("");
}

function nsidToType(nsid: string): string {
  return nsid
    .split(".")
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join("");
}

// Convenience shorthands for our VF types
const F = {
  action:           nsidToField(`${NS}.knowledge.action`),
  unit:             nsidToField(`${NS}.knowledge.unit`),
  resourceSpec:     nsidToField(`${NS}.knowledge.resourceSpecification`),
  processSpec:      nsidToField(`${NS}.knowledge.processSpecification`),
  spatialThing:     nsidToField(`${NS}.knowledge.spatialThing`),
  economicEvent:    nsidToField(`${NS}.observation.economicEvent`),
  economicResource: nsidToField(`${NS}.observation.economicResource`),
  person:           nsidToField(`${NS}.observation.person`),
  organization:     nsidToField(`${NS}.observation.organization`),
  commitment:       nsidToField(`${NS}.planning.commitment`),
  process:          nsidToField(`${NS}.planning.process`),
  agreement:        nsidToField(`${NS}.planning.agreement`),
  intent:           nsidToField(`${NS}.planning.intent`),
};

const T = {
  action:           nsidToType(`${NS}.knowledge.action`),
  unit:             nsidToType(`${NS}.knowledge.unit`),
  resourceSpec:     nsidToType(`${NS}.knowledge.resourceSpecification`),
  economicEvent:    nsidToType(`${NS}.observation.economicEvent`),
  economicResource: nsidToType(`${NS}.observation.economicResource`),
  person:           nsidToType(`${NS}.observation.person`),
  commitment:       nsidToType(`${NS}.planning.commitment`),
  process:          nsidToType(`${NS}.planning.process`),
};

// ── GraphQL client ────────────────────────────────────────────────────────────

interface GqlResponse<T = any> {
  data?: T;
  errors?: { message: string; locations?: any[]; path?: any[] }[];
}

const GQL_URL = `${QUICKSLICE_URL}/graphql`;

async function gql<T = any>(
  query: string,
  variables?: Record<string, any>,
  token?: string | null,
  timeoutMs = 30_000,
): Promise<GqlResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  async function doRequest(nonce?: string): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (token) {
      if (dpopPrivateKey) {
        // Public client: DPoP-bound token
        if (nonce) dpopNonce = nonce;
        headers["Authorization"] = `DPoP ${token}`;
        headers["DPoP"] = await makeDPoPProof("POST", GQL_URL);
      } else {
        // Fallback: Bearer (for confidential clients / manual tokens)
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return fetch(GQL_URL, {
      method:  "POST",
      headers,
      body:    JSON.stringify({ query, variables }),
      signal:  controller.signal,
    });
  }

  try {
    let res = await doRequest();

    // Handle DPoP nonce challenge (401 with dpop-nonce header)
    if (res.status === 401 && dpopPrivateKey) {
      const body = await res.text();
      let nonce = res.headers.get("dpop-nonce");
      if (!nonce) {
        try { nonce = JSON.parse(body)?.dpop_nonce ?? null; } catch {}
      }
      if (nonce) {
        res = await doRequest(nonce);
      } else {
        throw new Error(`HTTP 401: ${body.slice(0, 200)}`);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    // Persist any new nonce for subsequent requests
    const newNonce = res.headers.get("dpop-nonce");
    if (newNonce) dpopNonce = newNonce;

    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ── Global schema state ───────────────────────────────────────────────────────
// Populated by the top-level beforeAll before any describe block runs.

let queryFields: string[]  = [];
let schemaTypeNames: string[] = [];
let lexiconsLoaded = false;

beforeAll(async () => {
  try {
    // Step 1: basic connectivity
    const ping = await gql("{ __typename }", undefined, undefined, 10_000);
    if (ping.errors || ping.data?.__typename !== "Query") return;

    // Step 2: discover registered query fields and types
    const schema = await gql(
      `{
        __schema {
          queryType { fields { name } }
          types { name }
        }
      }`,
      undefined,
      undefined,
      15_000,
    );
    if (schema.errors) return;

    queryFields    = (schema.data?.__schema?.queryType?.fields ?? []).map((f: any) => f.name);
    schemaTypeNames = (schema.data?.__schema?.types ?? []).map((t: any) => t.name);

    // Our lexicons are loaded if at least the core action type is queryable
    lexiconsLoaded = queryFields.includes(F.action);

    if (!lexiconsLoaded) {
      console.warn(
        `\n⚠  Lexicons not loaded in Quickslice.\n` +
        `   Expected query field "${F.action}" — not found.\n` +
        `   Upload your record lexicons at Settings → Lexicons, then re-run.\n` +
        `   Schema has ${queryFields.length} query fields, ${schemaTypeNames.length} types.\n`,
      );
    }
  } catch (err: any) {
    console.warn(`\n⚠  Schema introspection failed: ${err.message}\n`);
  }
}, 30_000);

// ── 1. Connectivity ───────────────────────────────────────────────────────────

describe("connectivity", () => {
  test("GraphQL endpoint responds", async () => {
    const res = await gql("{ __typename }");
    expect(res.errors).toBeUndefined();
    expect(res.data?.__typename).toBe("Query");
  }, 10_000);

  test("introspection is enabled", async () => {
    const res = await gql("{ __schema { queryType { name } } }");
    expect(res.errors).toBeUndefined();
    expect(res.data?.__schema.queryType.name).toBe("Query");
  }, 10_000);

  test("viewer returns null when unauthenticated (not an error)", async () => {
    const res = await gql("{ viewer { did handle } }");
    expect(res.errors).toBeUndefined();
    expect(res.data?.viewer).toBeNull();
  }, 10_000);
});

// ── 2. Schema validation ──────────────────────────────────────────────────────

describe("schema — our types are registered", () => {
  // Every record lexicon should generate a top-level query field.
  // These tests are skipped (not failed) when lexicons aren't loaded yet.
  for (const [label, field] of Object.entries(F)) {
    test.if(lexiconsLoaded)(`query field "${field}" exists (${label})`, () => {
      expect(queryFields).toContain(field);
    });
  }

  test.if(lexiconsLoaded)("aggregation query exists for actions", () => {
    expect(queryFields).toContain(`${F.action}Aggregated`);
  });

  test("viewer query always exists", () => {
    expect(queryFields).toContain("viewer");
  });
});

// ── 3. Relay connection format ────────────────────────────────────────────────

describe("Relay connection format", () => {
  test.if(lexiconsLoaded)("returns edges / pageInfo / totalCount shape", async () => {
    const res = await gql(`
      {
        ${F.action}(first: 1) {
          totalCount
          pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
          edges {
            cursor
            node { uri }
          }
        }
      }
    `);

    expect(res.errors).toBeUndefined();
    const conn = res.data?.[F.action];
    expect(conn).toBeDefined();
    expect(typeof conn.totalCount).toBe("number");
    expect(conn.pageInfo).toMatchObject({
      hasNextPage:     expect.any(Boolean),
      hasPreviousPage: expect.any(Boolean),
    });
    expect(Array.isArray(conn.edges)).toBe(true);
  }, 15_000);

  test.if(lexiconsLoaded)("each edge has cursor and node with uri", async () => {
    const res = await gql(`{ ${F.action}(first: 3) { edges { cursor node { uri } } } }`);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(typeof edge.cursor).toBe("string");
      expect(typeof edge.node.uri).toBe("string");
    }
  }, 15_000);
});

// ── 4. Built-in fields ────────────────────────────────────────────────────────

describe("built-in fields", () => {
  test.if(lexiconsLoaded)(
    "every record exposes uri, cid, did, actorHandle, indexedAt, collection",
    async () => {
      const res = await gql(`
        {
          ${F.action}(first: 5) {
            edges {
              node {
                uri
                cid
                did
                actorHandle
                indexedAt
                collection
              }
            }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.action].edges ?? []) {
        const n = edge.node;
        expect(n.uri).toMatch(/^at:\/\//);
        expect(typeof n.cid).toBe("string");
        expect(n.did).toMatch(/^did:/);
        expect(typeof n.actorHandle).toBe("string");
        expect(typeof n.indexedAt).toBe("string");
        expect(n.collection).toBe(`${NS}.knowledge.action`);
      }
    },
    15_000,
  );
});

// ── 5. Filtering ──────────────────────────────────────────────────────────────

describe("filtering", () => {
  test.if(lexiconsLoaded)("where: eq filters by exact value", async () => {
    const res = await gql(`
      {
        ${F.action}(where: { actionId: { eq: "consume" } }) {
          totalCount
          edges { node { actionId } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(edge.node.actionId).toBe("consume");
    }
  }, 15_000);

  test.if(lexiconsLoaded)("where: ne excludes a value", async () => {
    const res = await gql(`
      {
        ${F.action}(where: { actionId: { ne: "consume" } }, first: 20) {
          edges { node { actionId } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(edge.node.actionId).not.toBe("consume");
    }
  }, 15_000);

  test.if(lexiconsLoaded)("where: in filters to a set of values", async () => {
    const res = await gql(`
      {
        ${F.action}(where: { actionId: { in: ["consume", "produce", "transfer"] } }) {
          edges { node { actionId } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(["consume", "produce", "transfer"]).toContain(edge.node.actionId);
    }
  }, 15_000);

  test.if(lexiconsLoaded)("where: contains does substring match", async () => {
    const res = await gql(`
      {
        ${F.action}(where: { label: { contains: "transfer" } }) {
          edges { node { label } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(edge.node.label.toLowerCase()).toContain("transfer");
    }
  }, 15_000);

  test.if(lexiconsLoaded)("where: isNull finds records with a missing optional field", async () => {
    const res = await gql(`
      {
        ${F.action}(where: { pairsWith: { isNull: true } }, first: 5) {
          edges { node { uri pairsWith } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(edge.node.pairsWith).toBeNull();
    }
  }, 15_000);

  test.if(lexiconsLoaded)("where: multiple conditions are ANDed", async () => {
    const res = await gql(`
      {
        ${F.action}(
          where: {
            inputOutput: { eq: "input" }
            actionId: { ne: "accept" }
          }
        ) {
          edges { node { actionId inputOutput } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(edge.node.inputOutput).toBe("input");
      expect(edge.node.actionId).not.toBe("accept");
    }
  }, 15_000);
});

// ── 6. Sorting ────────────────────────────────────────────────────────────────

describe("sorting", () => {
  test.if(lexiconsLoaded)("sortBy DESC on indexedAt returns newest first", async () => {
    const res = await gql(`
      {
        ${F.economicEvent}(
          first: 5
          sortBy: [{ field: indexedAt, direction: DESC }]
        ) {
          edges { node { indexedAt } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    const dates = (res.data?.[F.economicEvent].edges ?? []).map(
      (e: any) => new Date(e.node.indexedAt).getTime(),
    );
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i - 1]).toBeGreaterThanOrEqual(dates[i]);
    }
  }, 15_000);

  test.if(lexiconsLoaded)("sortBy ASC on actionId returns alphabetical order", async () => {
    const res = await gql(`
      {
        ${F.action}(
          first: 10
          sortBy: [{ field: actionId, direction: ASC }]
        ) {
          edges { node { actionId } }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    const ids = (res.data?.[F.action].edges ?? []).map((e: any) => e.node.actionId);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  }, 15_000);
});

// ── 7. Pagination ─────────────────────────────────────────────────────────────

describe("pagination", () => {
  test.if(lexiconsLoaded)("first: N limits results", async () => {
    const res = await gql(`{ ${F.action}(first: 3) { edges { node { uri } } } }`);
    expect(res.errors).toBeUndefined();
    expect(res.data?.[F.action].edges.length).toBeLessThanOrEqual(3);
  }, 15_000);

  test.if(lexiconsLoaded)("after cursor returns next page with different records", async () => {
    const page1 = await gql(`
      {
        ${F.action}(first: 1) {
          edges { node { uri } cursor }
          pageInfo { hasNextPage endCursor }
        }
      }
    `);
    expect(page1.errors).toBeUndefined();
    if (!page1.data?.[F.action].pageInfo.hasNextPage) return; // not enough data

    const cursor = page1.data?.[F.action].pageInfo.endCursor;
    const page2 = await gql(`
      {
        ${F.action}(first: 1, after: "${cursor}") {
          edges { node { uri } }
        }
      }
    `);
    expect(page2.errors).toBeUndefined();
    const uri1 = page1.data?.[F.action].edges[0]?.node.uri;
    const uri2 = page2.data?.[F.action].edges[0]?.node.uri;
    if (uri1 && uri2) expect(uri1).not.toBe(uri2);
  }, 20_000);

  test.if(lexiconsLoaded)("totalCount is consistent across pages", async () => {
    const full  = await gql(`{ ${F.action} { totalCount } }`);
    const paged = await gql(`{ ${F.action}(first: 1) { totalCount } }`);
    expect(full.errors).toBeUndefined();
    expect(paged.errors).toBeUndefined();
    expect(full.data?.[F.action].totalCount).toBe(paged.data?.[F.action].totalCount);
  }, 20_000);
});

// ── 8. Forward joins ──────────────────────────────────────────────────────────
// Quickslice generates {fieldName}Resolved for every AT-URI / strong-ref field.

describe("forward joins ({fieldName}Resolved)", () => {
  test.if(lexiconsLoaded)("economicEvent.actionResolved returns an Action record", async () => {
    const res = await gql(`
      {
        ${F.economicEvent}(first: 5) {
          edges {
            node {
              uri
              action
              actionResolved {
                ... on ${T.action} {
                  uri
                  actionId
                  label
                }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.economicEvent].edges ?? []) {
      if (edge.node.action && edge.node.actionResolved) {
        expect(edge.node.actionResolved.uri).toMatch(/^at:\/\//);
        expect(typeof edge.node.actionResolved.actionId).toBe("string");
      }
    }
  }, 20_000);

  test.if(lexiconsLoaded)(
    "economicEvent.resourceInventoriedAsResolved returns an EconomicResource",
    async () => {
      const res = await gql(`
        {
          ${F.economicEvent}(
            first: 5
            where: { resourceInventoriedAs: { isNull: false } }
          ) {
            edges {
              node {
                resourceInventoriedAs
                resourceInventoriedAsResolved {
                  ... on ${T.economicResource} {
                    uri
                    name
                  }
                }
              }
            }
          }
        }
      `);
      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.economicEvent].edges ?? []) {
        if (edge.node.resourceInventoriedAsResolved) {
          expect(edge.node.resourceInventoriedAsResolved.uri).toMatch(/^at:\/\//);
        }
      }
    },
    20_000,
  );

  test.if(lexiconsLoaded)("commitment.inputOfResolved returns a Process", async () => {
    const res = await gql(`
      {
        ${F.commitment}(first: 5, where: { inputOf: { isNull: false } }) {
          edges {
            node {
              inputOf
              inputOfResolved {
                ... on ${T.process} { uri }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.commitment].edges ?? []) {
      if (edge.node.inputOfResolved) {
        expect(edge.node.inputOfResolved.uri).toMatch(/^at:\/\//);
      }
    }
  }, 20_000);
});

// ── 9. Reverse joins ──────────────────────────────────────────────────────────
// Quickslice generates {CollectionField}Via{FieldName} to find all records
// that reference a given record. Returns a paginated connection.

describe("reverse joins ({Collection}Via{Field})", () => {
  test.if(lexiconsLoaded)(
    "action record has reverse join for economic events via action field",
    async () => {
      const res = await gql(`
        {
          ${F.action}(first: 3) {
            edges {
              node {
                uri
                actionId
                ${F.economicEvent}ViaAction {
                  totalCount
                  edges { node { uri } }
                }
              }
            }
          }
        }
      `);
      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.action].edges ?? []) {
        const reverseJoin = edge.node[`${F.economicEvent}ViaAction`];
        expect(typeof reverseJoin.totalCount).toBe("number");
        expect(Array.isArray(reverseJoin.edges)).toBe(true);
      }
    },
    20_000,
  );

  test.if(lexiconsLoaded)("action record: commitment and intent reverse join counts", async () => {
    const res = await gql(`
      {
        ${F.action}(first: 5) {
          edges {
            node {
              actionId
              ${F.commitment}ViaAction { totalCount }
              ${F.intent}ViaAction    { totalCount }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.action].edges ?? []) {
      expect(typeof edge.node[`${F.commitment}ViaAction`].totalCount).toBe("number");
      expect(typeof edge.node[`${F.intent}ViaAction`].totalCount).toBe("number");
    }
  }, 20_000);

  test.if(lexiconsLoaded)("process record: events via inputOf and outputOf", async () => {
    const res = await gql(`
      {
        ${F.process}(first: 3) {
          edges {
            node {
              uri
              ${F.economicEvent}ViaInputOf  { totalCount }
              ${F.economicEvent}ViaOutputOf { totalCount }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.process].edges ?? []) {
      expect(typeof edge.node[`${F.economicEvent}ViaInputOf`].totalCount).toBe("number");
      expect(typeof edge.node[`${F.economicEvent}ViaOutputOf`].totalCount).toBe("number");
    }
  }, 20_000);

  test.if(lexiconsLoaded)("reverse join supports sorting", async () => {
    const res = await gql(`
      {
        ${F.action}(first: 1, where: { actionId: { eq: "consume" } }) {
          edges {
            node {
              ${F.economicEvent}ViaAction(
                first: 5
                sortBy: [{ field: indexedAt, direction: DESC }]
              ) {
                totalCount
                edges { node { uri indexedAt } }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    const join = res.data?.[F.action]?.edges[0]?.node?.[`${F.economicEvent}ViaAction`];
    if (join) {
      expect(typeof join.totalCount).toBe("number");
    }
  }, 20_000);
});

// ── 10. DID joins ─────────────────────────────────────────────────────────────
// {CollectionField}ByDid finds records by the same author (DID) as the current record.

describe("DID joins ({Collection}ByDid)", () => {
  test.if(lexiconsLoaded)("economicEvent has author's person record via ByDid", async () => {
    const res = await gql(`
      {
        ${F.economicEvent}(first: 3) {
          edges {
            node {
              did
              ${F.person}ByDid {
                edges { node { uri did } }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.economicEvent].edges ?? []) {
      const byDid = edge.node[`${F.person}ByDid`];
      expect(byDid).toBeDefined();
      for (const personEdge of byDid?.edges ?? []) {
        expect(personEdge.node.did).toBe(edge.node.did);
      }
    }
  }, 20_000);

  test.if(lexiconsLoaded)("person ByDid: get all economicEvents by the same author", async () => {
    const res = await gql(`
      {
        ${F.person}(first: 3) {
          edges {
            node {
              did
              ${F.economicEvent}ByDid(
                first: 5
                sortBy: [{ field: indexedAt, direction: DESC }]
              ) {
                totalCount
                edges { node { uri } }
              }
            }
          }
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const edge of res.data?.[F.person].edges ?? []) {
      const byDid = edge.node[`${F.economicEvent}ByDid`];
      expect(typeof byDid.totalCount).toBe("number");
    }
  }, 20_000);
});

// ── 11. Aggregations ──────────────────────────────────────────────────────────

describe("aggregations", () => {
  test.if(lexiconsLoaded)("action aggregated by actionId returns counts", async () => {
    const res = await gql(`
      {
        ${F.action}Aggregated(
          groupBy: [{ field: actionId }]
          orderBy: { count: DESC }
        ) {
          actionId
          count
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    const rows = res.data?.[`${F.action}Aggregated`] ?? [];
    for (const row of rows) {
      expect(typeof row.actionId).toBe("string");
      expect(typeof row.count).toBe("number");
      expect(row.count).toBeGreaterThan(0);
    }
  }, 20_000);

  test.if(lexiconsLoaded)("economicEvent aggregated by indexedAt month", async () => {
    const res = await gql(`
      {
        ${F.economicEvent}Aggregated(
          groupBy: [{ field: indexedAt, interval: MONTH }]
          orderBy: { count: DESC }
          limit: 12
        ) {
          indexedAt
          count
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    const rows = res.data?.[`${F.economicEvent}Aggregated`] ?? [];
    for (const row of rows) {
      expect(typeof row.count).toBe("number");
    }
  }, 20_000);

  test.if(lexiconsLoaded)("aggregation with where filter", async () => {
    const res = await gql(`
      {
        ${F.economicEvent}Aggregated(
          groupBy: [{ field: did }]
          where: { indexedAt: { gt: "2020-01-01T00:00:00Z" } }
          orderBy: { count: DESC }
          limit: 10
        ) {
          did
          count
        }
      }
    `);
    expect(res.errors).toBeUndefined();
    for (const row of res.data?.[`${F.economicEvent}Aggregated`] ?? []) {
      expect(typeof row.did).toBe("string");
      expect(typeof row.count).toBe("number");
    }
  }, 20_000);
});

// ── 12. Viewer state ──────────────────────────────────────────────────────────
// viewer{Collection}Via{Field} — shows the authenticated user's records that
// reference the current record. Returns null without auth (no error thrown).
// Authentication required: set QUICKSLICE_TOKEN (Confidential client Bearer token).

describe("viewer state", () => {
  test("viewer returns null when unauthenticated (no error)", async () => {
    const res = await gql("{ viewer { did handle } }");
    expect(res.errors).toBeUndefined();
    expect(res.data?.viewer).toBeNull();
  }, 10_000);

  test.if(lexiconsLoaded)(
    "viewerState fields return null (not an error) when unauthenticated",
    async () => {
      const res = await gql(`
        {
          ${F.action}(first: 3) {
            edges {
              node {
                uri
                viewer${T.economicEvent}ViaAction { uri }
              }
            }
          }
        }
      `);
      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.action].edges ?? []) {
        expect(edge.node[`viewer${T.economicEvent}ViaAction`]).toBeNull();
      }
    },
    20_000,
  );

  test.if(hasAuth)("viewer returns user info with Bearer token (Confidential client)", async () => {
    const res = await gql("{ viewer { did handle } }", undefined, TOKEN);
    expect(res.errors).toBeUndefined();
    expect(res.data?.viewer?.did).toMatch(/^did:/);
    expect(typeof res.data?.viewer?.handle).toBe("string");
  }, 15_000);

  test.if(hasAuth && lexiconsLoaded)(
    "viewer state fields resolve records when authenticated",
    async () => {
      const res = await gql(
        `
        {
          ${F.action}(first: 5) {
            edges {
              node {
                uri
                viewer${T.economicEvent}ViaAction { uri }
              }
            }
          }
        }
      `,
        undefined,
        TOKEN,
      );
      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.action].edges ?? []) {
        const v = edge.node[`viewer${T.economicEvent}ViaAction`];
        if (v !== null) {
          expect(v.uri).toMatch(/^at:\/\//);
        }
      }
    },
    20_000,
  );
});

// ── 13. CRUD mutations (auth-gated) ───────────────────────────────────────────
// Quickslice mutations write to the user's PDS and index locally.
// Requires QUICKSLICE_TOKEN from a Confidential OAuth client.

describe("mutations — CRUD lifecycle", () => {
  let createdRkey: string | null = null;

  test.if(hasAuth)("createAction: creates a record and returns uri", async () => {
    const res = await gql(
      `
      mutation CreateTestAction($input: Create${T.action}Input!) {
        create${T.action}(input: $input) {
          uri
          actionId
          label
        }
      }
    `,
      {
        input: {
          actionId: "testActionForGraphqlTests",
          label:    "Test (GraphQL test suite)",
        },
      },
      TOKEN,
    );

    expect(res.errors).toBeUndefined();
    const created = res.data?.[`create${T.action}`];
    expect(created.uri).toMatch(/^at:\/\//);
    expect(created.actionId).toBe("testActionForGraphqlTests");

    createdRkey = created.uri.split("/").pop() ?? null;
  }, 20_000);

  test.if(hasAuth)("updateAction: updates the created record", async () => {
    if (!createdRkey) return;
    const res = await gql(
      `
      mutation UpdateTestAction($rkey: String!, $input: Update${T.action}Input!) {
        update${T.action}(rkey: $rkey, input: $input) {
          uri
          label
        }
      }
    `,
      {
        rkey:  createdRkey,
        input: {
          actionId: "testActionForGraphqlTests",
          label:    "Test (updated by GraphQL test suite)",
        },
      },
      TOKEN,
    );

    expect(res.errors).toBeUndefined();
    expect(res.data?.[`update${T.action}`].label).toBe(
      "Test (updated by GraphQL test suite)",
    );
  }, 20_000);

  test.if(hasAuth)("updated record is queryable immediately", async () => {
    if (!createdRkey) return;
    const res = await gql(
      `
      {
        ${F.action}(where: { actionId: { eq: "testActionForGraphqlTests" } }) {
          edges { node { actionId label } }
        }
      }
    `,
      undefined,
      TOKEN,
    );

    expect(res.errors).toBeUndefined();
    const record = res.data?.[F.action].edges[0]?.node;
    if (record) {
      expect(record.label).toBe("Test (updated by GraphQL test suite)");
    }
  }, 20_000);

  test.if(hasAuth)("deleteAction: deletes the created record", async () => {
    if (!createdRkey) return;
    const res = await gql(
      `
      mutation DeleteTestAction($rkey: String!) {
        delete${T.action}(rkey: $rkey) { uri }
      }
    `,
      { rkey: createdRkey },
      TOKEN,
    );

    expect(res.errors).toBeUndefined();
    expect(res.data?.[`delete${T.action}`].uri).toMatch(/^at:\/\//);
  }, 20_000);

  test.if(!hasAuth)("mutations return a GraphQL error without auth", async () => {
    const res = await gql(`
      mutation {
        create${T.action}(input: { actionId: "noAuth", label: "Should fail" }) {
          uri
        }
      }
    `);
    expect(res.errors).toBeDefined();
    expect(res.errors!.length).toBeGreaterThan(0);
  }, 15_000);
});

// ── 14. Combined query — the "rich feed" pattern ──────────────────────────────
// The key value of Quickslice: one query that replaces many XRPC calls.

describe("combined query — ValueFlows event feed", () => {
  test.if(lexiconsLoaded)(
    "economic events with action, resource, and author in one request",
    async () => {
      const res = await gql(`
        {
          ${F.economicEvent}(
            first: 5
            sortBy: [{ field: indexedAt, direction: DESC }]
          ) {
            totalCount
            edges {
              node {
                uri
                did
                actorHandle
                indexedAt

                actionResolved {
                  ... on ${T.action} {
                    actionId
                    label
                    inputOutput
                  }
                }

                resourceInventoriedAsResolved {
                  ... on ${T.economicResource} {
                    uri
                    name
                  }
                }

                ${F.person}ByDid {
                  edges { node { uri } }
                }
              }
            }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      const conn = res.data?.[F.economicEvent];
      expect(typeof conn.totalCount).toBe("number");
      expect(Array.isArray(conn.edges)).toBe(true);

      for (const edge of conn.edges) {
        const n = edge.node;
        expect(n.uri).toMatch(/^at:\/\//);
        expect(n.did).toMatch(/^did:/);
        expect(typeof n.actorHandle).toBe("string");

        if (n.actionResolved) {
          expect(typeof n.actionResolved.actionId).toBe("string");
        }
        if (n.resourceInventoriedAsResolved) {
          expect(n.resourceInventoriedAsResolved.uri).toMatch(/^at:\/\//);
        }
      }
    },
    30_000,
  );

  test.if(lexiconsLoaded)(
    "action usage summary — reverse joins give engagement counts",
    async () => {
      const res = await gql(`
        {
          ${F.action}(first: 10, sortBy: [{ field: actionId, direction: ASC }]) {
            edges {
              node {
                actionId
                label

                ${F.economicEvent}ViaAction { totalCount }
                ${F.commitment}ViaAction   { totalCount }
                ${F.intent}ViaAction       { totalCount }
              }
            }
          }
        }
      `);

      expect(res.errors).toBeUndefined();
      for (const edge of res.data?.[F.action].edges ?? []) {
        const n = edge.node;
        expect(typeof n[`${F.economicEvent}ViaAction`].totalCount).toBe("number");
        expect(typeof n[`${F.commitment}ViaAction`].totalCount).toBe("number");
        expect(typeof n[`${F.intent}ViaAction`].totalCount).toBe("number");
      }
    },
    30_000,
  );
});
