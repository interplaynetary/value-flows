#!/usr/bin/env bun
/**
 * GraphQL Gateway for ValueFlows on AT Protocol / HappyView
 *
 * Reads lexicons/${LEXICON_NS}/**‌/*.json, auto-generates a typed GraphQL
 * schema, and proxies queries to the HappyView XRPC API. DataLoader
 * deduplicates and caches AT-URI field resolution within each request.
 *
 * Usage:  bun scripts/graphql-gateway.ts
 * Env:    HAPPYVIEW_URL, PORT (default 4000), NSID (e.g. "org.openassociation")
 */

import { ApolloServer } from "@apollo/server";
import DataLoader from "dataloader";
import { Glob } from "bun";

// ── Config ────────────────────────────────────────────────────────────────────

const HAPPYVIEW_URL =
  process.env.HAPPYVIEW_URL ?? "https://happyview-production.up.railway.app";
const PORT = parseInt(process.env.PORT ?? "4000", 10);
const NS = process.env.NSID ?? "org.openassociation";

// ── Lexicon loading ───────────────────────────────────────────────────────────

interface LexiconFile {
  id: string;
  type: string; // "record" | "query" | "procedure" | "defs"
  content: any;
}

async function loadLexicons(ns: string): Promise<LexiconFile[]> {
  const results: LexiconFile[] = [];
  // ns may contain dots (e.g. "org.openassociation") — used as a directory name as-is
  for await (const file of new Glob(`lexicons/${ns}/**/*.json`).scan(".")) {
    const content = await Bun.file(file).json();
    const type: string = content.defs?.main?.type ?? "defs";
    results.push({ id: content.id, type, content });
  }
  return results;
}

// ── Name helpers ──────────────────────────────────────────────────────────────

/** "vf.observation.economicEvent" → "EconomicEvent" */
function nsidToTypeName(nsid: string): string {
  const seg = nsid.split(".").pop()!;
  return seg[0].toUpperCase() + seg.slice(1);
}

/** "vf.knowledge.listActions" → "Action" */
function listNsidToSingular(nsid: string): string {
  const seg = nsid.split(".").pop()!.replace(/^list/, ""); // "Actions"
  if (seg.endsWith("ies")) return seg.slice(0, -3) + "y";   // agencies → Agency
  if (seg.endsWith("ses")) return seg.slice(0, -3) + "s";   // Processes → Process
  if (seg.endsWith("s"))   return seg.slice(0, -1);          // Actions → Action
  return seg;
}

/** "vf.knowledge.listActions" → "actions" */
function listNsidToField(nsid: string): string {
  const seg = nsid.split(".").pop()!.replace(/^list/, ""); // "Actions"
  return seg[0].toLowerCase() + seg.slice(1); // "actions"
}

// ── AT-URI field → XRPC resolver config ──────────────────────────────────────
//
// Maps a lexicon field name (when format: at-uri) to the HappyView list NSID
// that can resolve it by ?uri=...  Covers all VF relationships.

const FIELD_TO_NSID: Record<string, string> = {
  // Economic flows
  action:                   `${NS}.knowledge.listActions`,
  inputOf:                  `${NS}.planning.listProcesses`,
  outputOf:                 `${NS}.planning.listProcesses`,
  resourceInventoriedAs:    `${NS}.observation.listEconomicResources`,
  toResourceInventoriedAs:  `${NS}.observation.listEconomicResources`,
  corrects:                 `${NS}.observation.listEconomicEvents`,
  // Resources
  conformsTo:               `${NS}.knowledge.listResourceSpecifications`,
  resourceConformsTo:       `${NS}.knowledge.listResourceSpecifications`,
  containedIn:              `${NS}.observation.listEconomicResources`,
  contains:                 `${NS}.observation.listEconomicResources`,
  ofBatchLot:               `${NS}.observation.listBatchLotRecords`,
  unitOfEffort:             `${NS}.knowledge.listUnits`,
  // Location
  toLocation:               `${NS}.knowledge.listSpatialThings`,
  atLocation:               `${NS}.knowledge.listSpatialThings`,
  primaryLocation:          `${NS}.knowledge.listSpatialThings`,
  currentLocation:          `${NS}.knowledge.listSpatialThings`,
  // Planning
  realizationOf:            `${NS}.planning.listAgreements`,
  reciprocalRealizationOf:  `${NS}.planning.listAgreements`,
  clauseOf:                 `${NS}.planning.listAgreements`,
  reciprocalClauseOf:       `${NS}.planning.listAgreements`,
  plannedWithin:            `${NS}.planning.listPlans`,
  independentDemandOf:      `${NS}.planning.listPlans`,
  stage:                    `${NS}.knowledge.listProcessSpecifications`,
  publishedIn:              `${NS}.planning.listProposalLists`,
  // Measure embedded type
  hasUnit:                  `${NS}.knowledge.listUnits`,
  // Array AT-URI fields
  settles:                  `${NS}.planning.listClaims`,
  fulfills:                 `${NS}.planning.listCommitments`,
  satisfies:                `${NS}.planning.listIntents`,
  stipulates:               `${NS}.planning.listCommitments`,
};

// ── XRPC client ───────────────────────────────────────────────────────────────

async function xrpcGet(nsid: string, params: Record<string, any> = {}): Promise<any> {
  const url = new URL(`${HAPPYVIEW_URL}/xrpc/${nsid}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "NetworkError" }));
    throw new Error(err.message ?? err.error ?? `XRPC ${nsid} failed: ${res.status}`);
  }
  return res.json();
}

/** Flatten { uri, value } record envelope into a plain object. */
function flatten(r: { uri: string; value?: any }): any {
  return { uri: r.uri, ...(r.value ?? {}) };
}

// ── DataLoader factory ────────────────────────────────────────────────────────
// One DataLoader per NSID, instantiated per GraphQL request so the cache
// is request-scoped. Parallel fetches for distinct URIs; cache hits for dupes.

type Loaders = Map<string, DataLoader<string, any | null>>;

function makeLoaders(): Loaders {
  const loaders: Loaders = new Map();
  for (const nsid of new Set(Object.values(FIELD_TO_NSID))) {
    loaders.set(
      nsid,
      new DataLoader<string, any | null>(
        async (uris: readonly string[]) =>
          Promise.all(
            uris.map((uri) =>
              xrpcGet(nsid, { uri })
                .then((d) => (d.record ? flatten(d.record) : null))
                .catch(() => null),
            ),
          ),
        { cache: true },
      ),
    );
  }
  return loaders;
}

// ── Schema generation ─────────────────────────────────────────────────────────

function lexPropToGqlType(fieldName: string, prop: any): string | null {
  const { type, format, ref, items } = prop;

  if (type === "string") {
    if (format === "at-uri") {
      const nsid = FIELD_TO_NSID[fieldName];
      return nsid ? listNsidToSingular(nsid) : "String";
    }
    return "String";
  }
  if (type === "integer") return "Int";
  if (type === "boolean") return "Boolean";
  if (type === "ref" && ref === `${NS}.defs#measure`) return "Measure";
  if (type === "unknown") return "String";

  if (type === "array" && items) {
    if (items.type === "string" && items.format === "at-uri") {
      const nsid = FIELD_TO_NSID[fieldName];
      return nsid ? `[${listNsidToSingular(nsid)}]` : "[String]";
    }
    if (items.type === "string") return "[String]";
  }

  return null;
}

function buildTypeDefs(lexicons: LexiconFile[]): string {
  const parts: string[] = [];
  const queryFields: string[] = [];

  // Shared Measure type (from vf.defs#measure)
  parts.push(`\
type Measure {
  hasNumericalValue: Int!
  hasDenominator: Int
  hasUnit: Unit
}`);

  // One GraphQL type + Connection wrapper per record lexicon
  for (const lex of lexicons) {
    if (lex.type !== "record") continue;
    const typeName = nsidToTypeName(lex.id);
    const props: Record<string, any> =
      lex.content.defs?.main?.record?.properties ?? {};

    const fields = ["  uri: String!"];
    for (const [name, prop] of Object.entries(props)) {
      const gqlType = lexPropToGqlType(name, prop as any);
      if (gqlType) fields.push(`  ${name}: ${gqlType}`);
    }

    parts.push(`type ${typeName} {\n${fields.join("\n")}\n}`);
    parts.push(
      `type ${typeName}Connection {\n  records: [${typeName}!]!\n  cursor: String\n  hasMore: Boolean!\n}`,
    );
  }

  // Query fields — one per list lexicon
  for (const lex of lexicons) {
    if (lex.type !== "query") continue;
    const fieldName = listNsidToField(lex.id);
    const typeName  = listNsidToSingular(lex.id);
    const params: Record<string, any> =
      lex.content.defs?.main?.parameters?.properties ?? {};

    const args = Object.entries(params).map(([pName, pProp]: [string, any]) =>
      `${pName}: ${pProp.type === "integer" ? "Int" : "String"}`,
    );

    queryFields.push(`  ${fieldName}(${args.join(", ")}): ${typeName}Connection!`);
  }

  parts.push(`type Query {\n${queryFields.join("\n")}\n}`);
  return parts.join("\n\n");
}

// ── Resolver generation ───────────────────────────────────────────────────────

function buildResolvers(lexicons: LexiconFile[]): any {
  const Query: Record<string, any>              = {};
  const typeResolvers: Record<string, Record<string, any>> = {};

  // Query resolvers — proxy to XRPC, flatten envelope
  for (const lex of lexicons) {
    if (lex.type !== "query") continue;
    const nsid      = lex.id;
    const fieldName = listNsidToField(nsid);

    Query[fieldName] = async (_: any, args: any) => {
      const data = await xrpcGet(nsid, args);
      // Single-record fetch (?uri= was supplied)
      if (data.record) {
        return { records: [flatten(data.record)], cursor: null, hasMore: false };
      }
      return {
        records:  (data.records ?? []).map(flatten),
        cursor:   data.cursor ?? null,
        hasMore:  !!data.cursor,
      };
    };
  }

  // Field resolvers for AT-URI fields — use per-request DataLoaders
  for (const lex of lexicons) {
    if (lex.type !== "record") continue;
    const typeName = nsidToTypeName(lex.id);
    const props: Record<string, any> =
      lex.content.defs?.main?.record?.properties ?? {};
    const fieldRes: Record<string, any> = {};

    for (const [name, prop] of Object.entries(props)) {
      const targetNsid = FIELD_TO_NSID[name];
      if (!targetNsid) continue;

      if ((prop as any).type === "string" && (prop as any).format === "at-uri") {
        fieldRes[name] = (parent: any, _: any, ctx: any) => {
          const uri: string | undefined = parent[name];
          return uri ? ctx.loaders.get(targetNsid)!.load(uri) : null;
        };
      } else if (
        (prop as any).type === "array" &&
        (prop as any).items?.format === "at-uri"
      ) {
        fieldRes[name] = async (parent: any, _: any, ctx: any) => {
          const uris: string[] = parent[name] ?? [];
          if (!uris.length) return [];
          const loader = ctx.loaders.get(targetNsid)!;
          const results = await Promise.all(uris.map((u) => loader.load(u)));
          return results.filter(Boolean);
        };
      }
    }

    if (Object.keys(fieldRes).length > 0) {
      typeResolvers[typeName] = fieldRes;
    }
  }

  // Measure.hasUnit resolver (embedded type, not a record lexicon)
  typeResolvers["Measure"] = {
    hasUnit: (parent: any, _: any, ctx: any) => {
      const uri: string | undefined = parent.hasUnit;
      return uri ? ctx.loaders.get(`${NS}.knowledge.listUnits`)!.load(uri) : null;
    },
  };

  return { Query, ...typeResolvers };
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const lexicons = await loadLexicons(NS);
const records  = lexicons.filter((l) => l.type === "record").length;
const queries  = lexicons.filter((l) => l.type === "query").length;
console.log(`Loaded ${lexicons.length} lexicons (${records} records, ${queries} queries)`);

const typeDefs  = buildTypeDefs(lexicons);
const resolvers = buildResolvers(lexicons);

// Uncomment to inspect the generated SDL:
// console.log(typeDefs);

const server = new ApolloServer({ typeDefs, resolvers, introspection: true });
await server.start();

Bun.serve({
  port: PORT,

  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, lexicons: lexicons.length });
    }

    if (url.pathname !== "/graphql") {
      return new Response("Not found", { status: 404 });
    }

    // Build a Map<string, string> that Apollo Server 4 expects as headers
    const headers = new Map<string, string>();
    req.headers.forEach((v, k) => headers.set(k.toLowerCase(), v));

    const body =
      req.method === "POST"
        ? await req.json().catch(() => undefined)
        : undefined;

    const response = await server.executeHTTPGraphQLRequest({
      httpGraphQLRequest: {
        method: req.method,
        headers: headers as any, // satisfies Map<string, string> interface
        search: url.search ?? "",
        body,
      },
      context: async () => ({
        loaders: makeLoaders(),
        token: req.headers.get("authorization")?.slice(7) ?? null,
      }),
    });

    const resHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { resHeaders[k] = v; });

    if (response.body.kind === "complete") {
      return new Response(response.body.string, {
        status: response.status ?? 200,
        headers: resHeaders,
      });
    }

    // Streaming / chunked response
    const chunks: string[] = [];
    for await (const chunk of response.body.asyncIterator) {
      chunks.push(chunk);
    }
    return new Response(chunks.join(""), {
      status: response.status ?? 200,
      headers: resHeaders,
    });
  },
});

console.log(`🚀 GraphQL gateway → http://localhost:${PORT}/graphql`);
