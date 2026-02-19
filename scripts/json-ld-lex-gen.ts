#!/usr/bin/env bun
/**
 * Generic JSON-LD to AT Protocol Lexicon generator.
 * 
 * This version uses jsonld expansion to resolve IRIs and supports 
 * external schemas (OpenAPI/JSON Schema) to provide structural metadata.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import * as jsonld from "jsonld";

// ─── types ──────────────────────────────────────────────────────────────────

interface Mapping {
  [iri: string]: string; // IRI -> NSID
}

// ─── argument parsing ────────────────────────────────────────────────────────

function getArg(name: string): string | null {
  const idx = Bun.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < Bun.argv.length) {
    return (Bun.argv[idx + 1] as string) || null;
  }
  return null;
}

const CONTEXT_PATH = Bun.argv.slice(2).find(arg => arg.endsWith(".json") && !arg.includes("mapping") && !arg.includes("schema") && !arg.startsWith("-")) || "specs/ngsi/ngsi.json";
const SCHEMA_PATH = getArg("--schema") || "specs/ngsi/ngsi_api.json";
const MAPPING_PATH = getArg("--mapping") || "specs/ngsi/class-to-nsid.json";
const OUTPUT_BASE = getArg("--output") || "lexicons";
const ROOT: string = join(import.meta.dir, "..");

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveSchemaRef(ref: string, schema: any): any {
  if (!ref || !ref.startsWith("#/")) return null;
  const parts = ref.split("/").slice(1);
  let curr = schema;
  for (let p of parts) {
    p = p.replace(/~1/g, "/").replace(/~0/g, "~");
    curr = curr?.[p];
  }
  return curr;
}

function gatherProperties(node: any, schema: any): Record<string, any> {
  const props: Record<string, any> = {};
  if (node.$ref) {
    const resolved = resolveSchemaRef(node.$ref, schema);
    if (resolved) Object.assign(props, gatherProperties(resolved, schema));
  }
  if (node.allOf) {
    node.allOf.forEach((sub: any) => Object.assign(props, gatherProperties(sub, schema)));
  }
  if (node.properties) {
    Object.assign(props, node.properties);
  }
  return props;
}

/**
 * Attempts to find properties for a term/IRI in a schema.
 */
function findSchemaProperties(term: string, schema: any): Record<string, any> {
  const visited = new Set();

  const findDeep = (obj: any, target: string): any => {
    if (!obj || typeof obj !== "object" || visited.has(obj)) return null;
    visited.add(obj);
    
    // Match by direct key (standard definitions)
    if (obj[target] && typeof obj[target] === "object") return obj[target];
    
    // Match by title (OpenAPI/JSON Schema)
    if (obj.title === target || obj.title === `NGSI-LD ${target}`) return obj;

    // Special case: Discriminated unions / Const-based types
    if (obj.properties) {
      for (const p of Object.values(obj.properties)) {
        if ((p as any).const === target) return obj;
      }
    }

    for (const val of Object.values(obj)) {
      if (typeof val === "object") {
        const found = findDeep(val, target);
        if (found) return found;
      }
    }
    return null;
  };

  const definition = schema.definitions?.[term] || 
                     schema.components?.schemas?.[term] ||
                     findDeep(schema, term);

  if (definition) {
    return gatherProperties(definition, schema);
  }

  return {};
}

function processSchemaProperty(
  name: string,
  rawProp: any,
  defs: Record<string, any>,
  schema: any
): any {
  // Resolve ref if present to get structural info
  let struct = rawProp;
  let resolvedRef = rawProp.$ref ? resolveSchemaRef(rawProp.$ref, schema) : null;
  if (resolvedRef) struct = resolvedRef;

  // Combine with allOf if present (simple merge)
  if (struct.allOf) {
    struct = { ...struct };
    struct.allOf.forEach((sub: any) => {
        const r = sub.$ref ? resolveSchemaRef(sub.$ref, schema) : sub;
        if (r) Object.assign(struct, r);
    });
  }

  let type = "string";
  if (struct.type === "integer" || struct.type === "number") type = "integer";
  else if (struct.type === "boolean") type = "boolean";
  else if (struct.type === "array") type = "array";
  else if (struct.type === "object" || struct.properties) type = "object";

  let format: string | undefined;
  if (struct.format === "uri") format = "uri";
  else if (struct.format === "date-time") format = "datetime";

  // Handle Object: extract to defs
  if (type === "object") {
    // Generate a definition name. 
    // Prefer the ref name (e.g. Location), fallback to property name (e.g. primaryLocation)
    let defName = name;
    if (rawProp.$ref) {
      defName = rawProp.$ref.split("/").pop();
    } else if (struct.title) {
        defName = struct.title.replace(/ /g, "");
    }

    // Ensure defName is valid for Lexicon (first char alpha)
    defName = defName.replace(/[^a-zA-Z0-9]/g, "");
    if (/^[^a-zA-Z]/.test(defName)) defName = "Type" + defName;

    // Detect recursion or existing def
    if (!defs[defName]) {
      // Placeholder to prevent infinite recursion
      defs[defName] = { type: "object", properties: {} };

      const props: Record<string, any> = {};
      const childProps = gatherProperties(struct, schema);
      
      for (const [pName, pVal] of Object.entries(childProps)) {
         if (pName.startsWith("@")) continue;
         const safeName = pName.replace(/[^a-zA-Z0-9]/g, "");
         props[safeName] = processSchemaProperty(safeName, pVal, defs, schema);
      }
      
      defs[defName] = { 
          type: "object", 
          properties: props,
          description: struct.description || rawProp.description
      };
      if (struct.required) defs[defName].required = struct.required;
    }

    return { 
        type: "ref", 
        ref: `#${defName}`,
        description: rawProp.description || struct.description
    };
  }

  // Handle Array
  if (type === "array") {
      const items = processSchemaProperty(name + "Item", struct.items || {}, defs, schema);
      return {
          type: "array",
          items: items,
          description: rawProp.description || struct.description
      };
  }

  // Handle Primitives
  const prop: any = { 
      type, 
      description: rawProp.description || struct.description
  };
  if (format) prop.format = format;
  
  if (type === "unknown") {
      // Logic for unknown if we couldn't resolve type?
      // Default to string if unsure, or unknown for flexibility
  }

  return prop;
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║         GENERIC JSON-LD → AT PROTOCOL LEXICON GENERATOR        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  const fullContextPath = join(ROOT, CONTEXT_PATH);
  if (!existsSync(fullContextPath)) {
    console.error(`Error: Context file not found: ${fullContextPath}`);
    process.exit(1);
  }

  const contextJson = JSON.parse(readFileSync(fullContextPath, "utf-8"));
  const context = contextJson["@context"] || contextJson;

  // 1. Discover terms from context using jsonld.expand
  console.log(`  Resolving IRIs: ${CONTEXT_PATH}...`);
  
  const termKeys: string[] = [];
  const findKeys = (obj: any) => {
    if (Array.isArray(obj)) obj.forEach(findKeys);
    else if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (!k.startsWith("@")) termKeys.push(k);
        if (typeof obj[k] === 'object' && !(obj[k] as any)["@id"]) findKeys(obj[k]);
      }
    }
  }
  findKeys(context);
  const uniqueTermKeys = Array.from(new Set(termKeys));

  const mockObj: any = { "@context": context };
  uniqueTermKeys.forEach(k => mockObj[k] = k);
  
  console.log(`  Term keys found: ${uniqueTermKeys.length}`);
  const expanded = await jsonld.expand(mockObj);
  const iriToTerm: Record<string, string> = {};

  if (expanded.length > 0) {
    const item = expanded[0] as any;
    if (item && typeof item === "object") {
      for (const [key, val] of Object.entries(item)) {
         if (key.startsWith("@")) continue;
         const iri = Array.isArray(val) ? (val[0] as any)["@id"] : (val as any)["@id"];
         if (iri) {
           const term = uniqueTermKeys.find(tk => key.endsWith(tk)) || key;
           iriToTerm[iri] = term;
         }
      }
    }
  }
  console.log(`  Discovered IRIs: ${Object.keys(iriToTerm).length}`);

  // 2. Load Mapping
  let mapping: Mapping = {};
  const fullMappingPath = join(ROOT, MAPPING_PATH);
  if (existsSync(fullMappingPath)) {
    const content = readFileSync(fullMappingPath, "utf-8").trim();
    if (content) mapping = JSON.parse(content);
    console.log(`  Loaded mapping: ${MAPPING_PATH} (${Object.keys(mapping).length} entries)`);
  }

  // 3. Load Schema
  let schema: any = null;
  const fullSchemaPath = join(ROOT, SCHEMA_PATH);
  if (existsSync(fullSchemaPath)) {
    schema = JSON.parse(readFileSync(fullSchemaPath, "utf-8"));
    console.log(`  Loaded schema: ${SCHEMA_PATH}`);
  }

  // 4. Match mappings to terms and generate lexicons
  const mappedIris = new Set(Object.keys(mapping));
  for (const [iri, nsid] of Object.entries(mapping)) {
    let term = iriToTerm[iri] || iri.split("/").pop() || iri.split("#").pop() || nsid;
    if (iri.includes("purl.org/geojson")) term = iri.split("#").pop() || term;

    console.log(`  Processing ${nsid} (${term} ← ${iri})`);
    
    // Accumulate definitions for this lexicon
    const defs: Record<string, any> = {};
    const properties: Record<string, any> = {};

    if (schema) {
      const rawProps = findSchemaProperties(term, schema);
      for (const [pName, pVal] of Object.entries(rawProps)) {
        if (pName.startsWith("@")) continue;
        const safeName = pName.replace(/[^a-zA-Z0-9]/g, "");
        properties[safeName] = processSchemaProperty(safeName, pVal, defs, schema);
      }
    }

    const lexicon: any = {
      lexicon: 1,
      id: nsid,
      defs: {
        main: {
          type: "record",
          description: `Generated from ${iri}`,
          key: "id",
          record: {
            type: "object",
            required: Object.keys(properties).length > 0 ? ["id", "type"] : [],
            properties: {
              id: { type: "string", format: "uri", description: "Entity id" },
              type: { type: "string", description: "Entity type" },
              ...properties
            }
          }
        },
        ...defs
      }
    };

    const outPath = join(ROOT, OUTPUT_BASE, ...nsid.split(".")) + ".json";
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(lexicon, null, 2) + "\n");
    console.log(`    Wrote ${outPath} (${Object.keys(properties).length} derived props, ${Object.keys(defs).length} defs)`);
  }

  // 5. Report unmapped potential types
  console.log("\n  Potential unmapped types (IRIs starting with uppercase):");
  for (const [iri, term] of Object.entries(iriToTerm)) {
    if (!mappedIris.has(iri) && /^[A-Z]/.test(term)) {
      console.log(`    - ${term} (${iri})`);
    }
  }

  console.log("\n  Generation complete for mapped terms.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
