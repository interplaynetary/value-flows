#!/usr/bin/env bun
/**
 * Derives and generates AT Protocol query lexicons from VF record lexicons.
 *
 * Core insight: every reference property (at-uri, did) on a record type
 * naturally becomes a filter parameter on that record's list query. This
 * algorithmically produces all "inverse queries" from the VF query naming spec.
 *
 * Example derivation:
 *   EconomicEvent has `provider` (did) and `inputOf` (at-uri)
 *   → listEconomicEvents gets `provider` and `inputOf` filter params
 *   → VF spec's Agent.economicEventsAsProvider = listEconomicEvents?provider=<did>
 *   → VF spec's Process.economicEvents (input) = listEconomicEvents?inputOf=<at-uri>
 *
 * Three derivable filter patterns:
 *   1. Reference filters (at-uri, did) → covers ALL VF inverse queries
 *   2. Enum/knownValues filters → covers filtered queries (offers, requests)
 *   3. Boolean filters → covers state queries (finished)
 *
 * Not auto-generated (require hand-crafted logic):
 *   - Multi-hop traversals (involvedAgents, trace/track)
 *   - Negation queries (unplannedEconomicEvents)
 *   - Aggregations (plan.startDate)
 *   - Reciprocal queries (reciprocalEvents)
 *
 * Usage:
 *   bun scripts/generate/query-lex-gen.ts            # generate query lexicons
 *   bun scripts/generate/query-lex-gen.ts --dry-run   # preview without writing
 */

import { join, dirname } from "path";
import { mkdirSync } from "fs";
import { Glob } from "bun";

// ─── types ──────────────────────────────────────────────────────────────────

interface LexProp {
  type: string;
  format?: string;
  ref?: string;
  description?: string;
  knownValues?: string[];
  items?: LexProp;
}

interface RecordLexicon {
  lexicon: number;
  id: string;
  defs: {
    main: {
      type: string;
      description?: string;
      key: string;
      record: {
        type: "object";
        required?: string[];
        properties: Record<string, LexProp>;
      };
    };
  };
}

interface FilterParam {
  name: string;
  type: "string" | "boolean";
  format?: string;
  description: string;
  arrayContains?: boolean;
}

// ─── setup ──────────────────────────────────────────────────────────────────

const ROOT: string = join(import.meta.dir, "..", "..");
const DRY_RUN: boolean = Bun.argv.includes("--dry-run");

// ─── load record lexicons ───────────────────────────────────────────────────

async function loadRecordLexicons(): Promise<RecordLexicon[]> {
  const lexicons: RecordLexicon[] = [];
  const glob = new Glob("lexicons/vf/**/*.json");

  for await (const filePath of glob.scan(ROOT)) {
    const data = await Bun.file(join(ROOT, filePath)).json();
    if (data.defs?.main?.type === "record") {
      lexicons.push(data as RecordLexicon);
    }
  }

  return lexicons.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── helpers ────────────────────────────────────────────────────────────────

function pluralize(name: string): string {
  // Handles all VF class names correctly:
  //   process → processes, recipeProcess → recipeProcesses,
  //   economicEvent → economicEvents, person → persons, etc.
  if (
    name.endsWith("s") || name.endsWith("sh") ||
    name.endsWith("ch") || name.endsWith("x") || name.endsWith("z")
  ) {
    return name + "es";
  }
  return name + "s";
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function nsidGroup(nsid: string): string {
  return nsid.split(".").slice(0, -1).join(".");
}

function nsidName(nsid: string): string {
  return nsid.split(".").pop()!;
}

function nsidToPath(nsid: string): string {
  return join("lexicons", ...nsid.split(".")) + ".json";
}

// ─── derive filter parameters from record properties ────────────────────────

function deriveFilters(properties: Record<string, LexProp>): FilterParam[] {
  const filters: FilterParam[] = [];

  for (const [name, prop] of Object.entries(properties)) {
    // Direct at-uri reference → record/resource filter
    if (prop.type === "string" && prop.format === "at-uri") {
      filters.push({
        name,
        type: "string",
        format: "at-uri",
        description: `Filter by ${name} (AT-URI of referenced record).`,
      });
    }
    // Direct did reference → agent filter
    else if (prop.type === "string" && prop.format === "did") {
      filters.push({
        name,
        type: "string",
        format: "did",
        description: `Filter by ${name} (DID of referenced agent).`,
      });
    }
    // Array of at-uri → "contains" filter
    else if (prop.type === "array" && prop.items?.type === "string" && prop.items.format === "at-uri") {
      filters.push({
        name,
        type: "string",
        format: "at-uri",
        description: `Filter where ${name} array contains this AT-URI.`,
        arrayContains: true,
      });
    }
    // Array of did → "contains" filter
    else if (prop.type === "array" && prop.items?.type === "string" && prop.items.format === "did") {
      filters.push({
        name,
        type: "string",
        format: "did",
        description: `Filter where ${name} array contains this DID.`,
        arrayContains: true,
      });
    }
    // knownValues string → enum filter
    else if (prop.type === "string" && prop.knownValues && prop.knownValues.length > 0) {
      filters.push({
        name,
        type: "string",
        description: `Filter by ${name} value.`,
      });
    }
    // boolean → flag filter
    else if (prop.type === "boolean") {
      filters.push({
        name,
        type: "boolean",
        description: `Filter by ${name}.`,
      });
    }
  }

  return filters;
}

// ─── build list query lexicon ───────────────────────────────────────────────

function buildListQuery(record: RecordLexicon): { nsid: string; lexicon: object } {
  const group = nsidGroup(record.id);
  const name = nsidName(record.id);
  const plural = pluralize(name);
  const queryNsid = `${group}.list${capitalize(plural)}`;

  const filters = deriveFilters(record.defs.main.record.properties);

  // Assemble params: uri lookup + derived filters + pagination
  const paramProps: Record<string, any> = {};

  paramProps.uri = {
    type: "string",
    format: "at-uri",
    description: "Fetch a single record by AT-URI. Other filters are ignored when set.",
  };

  for (const f of filters) {
    const param: Record<string, any> = { type: f.type, description: f.description };
    if (f.format) param.format = f.format;
    paramProps[f.name] = param;
  }

  paramProps.limit = {
    type: "integer",
    minimum: 1,
    maximum: 100,
    default: 50,
    description: "Maximum number of records to return.",
  };

  paramProps.cursor = {
    type: "string",
    description: "Pagination cursor from a previous response.",
  };

  // Build description
  const filterNames = filters.map(f => f.name);
  const baseDesc = `List ${plural}.`;
  const filterDesc = filterNames.length > 0
    ? ` Filterable by: ${filterNames.join(", ")}.`
    : "";

  return {
    nsid: queryNsid,
    lexicon: {
      lexicon: 1,
      id: queryNsid,
      defs: {
        main: {
          type: "query",
          description: baseDesc + filterDesc,
          parameters: {
            type: "params",
            properties: paramProps,
          },
          output: {
            encoding: "application/json",
            schema: {
              type: "object",
              required: ["records"],
              properties: {
                records: {
                  type: "array",
                  items: {
                    type: "object",
                    required: ["uri"],
                    properties: {
                      uri: {
                        type: "string",
                        format: "at-uri",
                        description: "AT-URI of the record.",
                      },
                      value: {
                        type: "unknown",
                        description: "The full record value.",
                      },
                    },
                  },
                },
                cursor: {
                  type: "string",
                  description: "Pagination cursor for next page.",
                },
              },
            },
          },
        },
      },
    },
  };
}

// ─── main ───────────────────────────────────────────────────────────────────

const records = await loadRecordLexicons();

console.log("╔══════════════════════════════════════════════════════════════════╗");
console.log("║             VF QUERY LEXICON DERIVATION                        ║");
console.log("╚══════════════════════════════════════════════════════════════════╝\n");

let totalQueries = 0;
let totalFilters = 0;

for (const record of records) {
  const filters = deriveFilters(record.defs.main.record.properties);
  const { nsid, lexicon } = buildListQuery(record);

  console.log(`  ${record.id} → ${nsid}`);

  if (filters.length > 0) {
    for (const f of filters) {
      const tag = f.format || (f.type === "boolean" ? "bool" : "enum");
      const note = f.arrayContains ? " [contains]" : "";
      console.log(`    ${f.name} (${tag})${note}`);
    }
  } else {
    console.log("    (pagination only, no derived filters)");
  }

  if (!DRY_RUN) {
    const outPath = join(ROOT, nsidToPath(nsid));
    mkdirSync(dirname(outPath), { recursive: true });
    await Bun.write(outPath, JSON.stringify(lexicon, null, 2) + "\n");
    console.log(`    → ${nsidToPath(nsid)}`);
  }

  console.log();
  totalQueries++;
  totalFilters += filters.length;
}

// ─── summary ────────────────────────────────────────────────────────────────

console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log(`  Queries derived: ${totalQueries}`);
console.log(`  Total filter params: ${totalFilters}`);
console.log(`  Mode: ${DRY_RUN ? "dry run (no files written)" : "files written"}`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// ─── VF spec coverage mapping ───────────────────────────────────────────────

console.log("VF query spec coverage (inverse queries → filter params):\n");
console.log("  Agent inverse queries:");
console.log("    commitmentsAsProvider     → listCommitments?provider=<did>");
console.log("    commitmentsAsReceiver     → listCommitments?receiver=<did>");
console.log("    economicEventsAsProvider  → listEconomicEvents?provider=<did>");
console.log("    economicEventsAsReceiver  → listEconomicEvents?receiver=<did>");
console.log("    intentsAsProvider         → listIntents?provider=<did>");
console.log("    intentsAsReceiver         → listIntents?receiver=<did>");
console.log("    claimsAsProvider          → listClaims?provider=<did>");
console.log("    claimsAsReceiver          → listClaims?receiver=<did>");
console.log("    inventoriedResources      → listEconomicResources?primaryAccountable=<did>");
console.log("    processes (inScopeOf)     → listProcesses?inScopeOf=<did>");
console.log();
console.log("  Process inverse queries:");
console.log("    economicEvents (input)    → listEconomicEvents?inputOf=<at-uri>");
console.log("    economicEvents (output)   → listEconomicEvents?outputOf=<at-uri>");
console.log("    commitments (input)       → listCommitments?inputOf=<at-uri>");
console.log("    commitments (output)      → listCommitments?outputOf=<at-uri>");
console.log("    intents (input)           → listIntents?inputOf=<at-uri>");
console.log("    intents (output)          → listIntents?outputOf=<at-uri>");
console.log();
console.log("  ResourceSpecification inverse queries:");
console.log("    conformingResources       → listEconomicResources?conformsTo=<at-uri>");
console.log("    conformingEvents          → listEconomicEvents?resourceConformsTo=<at-uri>");
console.log("    conformingCommitments     → listCommitments?resourceConformsTo=<at-uri>");
console.log("    conformingIntents         → listIntents?resourceConformsTo=<at-uri>");
console.log();
console.log("  Filtered main queries:");
console.log("    offers                    → listProposals?purpose=offer");
console.log("    requests                  → listProposals?purpose=request");
console.log();
