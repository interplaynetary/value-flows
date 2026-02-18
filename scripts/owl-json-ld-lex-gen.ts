#!/usr/bin/env bun
/**
 * Generate AT Protocol Lexicon files from the ValueFlows OWL ontology (vf.json).
 *
 * Lessons learned & design decisions:
 * - Handle owl:DataTypeProperty AND owl:DatatypeProperty (case mismatch in source)
 * - Handle owl:unionOf with @list wrapper in JSON-LD
 * - Handle @type as both string and array
 * - Include ALL inverse/bidirectional properties
 * - Array items referencing records get format: "at-uri"; agent refs get format: "did"
 * - Classification arrays stay as plain strings (mixed URIs/tags)
 * - Agent is abstract → properties distributed to Person/Organization/EcologicalAgent
 * - Enum classes → knownValues strings, not separate records
 * - No floats in AT Protocol → numerator/denominator integers in Measure
 * - Note the vf:Agreenent typo in source → treat as vf:Agreement
 * - vf:separate action has label "unpack" — use "separate" as canonical
 * - ExternalLink not a VF record type — skip it from domain lists
 */

 import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";

// ─── argument parsing ────────────────────────────────────────────────────────

function getArg(name: string): string | null {
  const idx = Bun.argv.indexOf(name);
  if (idx !== -1 && idx + 1 < Bun.argv.length) {
    return (Bun.argv[idx + 1] as string) || null;
  }
  return null;
}

const ONTOLOGY_PATH = Bun.argv.slice(2).find(arg => arg.endsWith(".json") && !arg.includes("mapping") && !arg.startsWith("-")) || "specs/vf/vf.json";
const MAPPING_PATH = getArg("--mapping") || "specs/vf/class-to-nsid.json";
const OUTPUT_BASE = getArg("--output") || "lexicons";
const AUDIT_MODE: boolean = Bun.argv.includes("--audit");
const ROOT: string = join(import.meta.dir, "..");
const NS: string = process.env.NSID ?? "org.openassociation";

if (Bun.argv.includes("--debug")) {
  console.log(`Debug: ROOT=${ROOT}`);
  console.log(`Debug: ONTOLOGY_PATH=${ONTOLOGY_PATH}`);
  console.log(`Debug: MAPPING_PATH=${MAPPING_PATH}`);
}

// ─── load config ─────────────────────────────────────────────────────────────

const fullOntologyPath = join(ROOT, ONTOLOGY_PATH);
if (!existsSync(fullOntologyPath)) {
  console.error(`Error: Ontology file not found: ${fullOntologyPath}`);
  process.exit(1);
}

const ontologyJson = JSON.parse(readFileSync(fullOntologyPath, "utf-8"));
const graph: OwlNode[] = ontologyJson["@graph"] || [ontologyJson]; // Fallback if no @graph

let CLASS_TO_NSID: Record<string, string> = {};
const fullMappingPath = join(ROOT, MAPPING_PATH);
if (existsSync(fullMappingPath)) {
  CLASS_TO_NSID = JSON.parse(readFileSync(fullMappingPath, "utf-8"));
} else {
  console.log(`Warning: Mapping file not found: ${fullMappingPath}. Using empty mapping.`);
}

interface OwlNode {
  "@id": string;
  "@type"?: string | string[];
  "rdfs:label"?: string | { "@value": string };
  "rdfs:comment"?: string | { "@value": string };
  "rdfs:domain"?: { "@id": string } | { "owl:unionOf": OwlUnion };
  "rdfs:range"?: { "@id": string } | { "owl:unionOf": OwlUnion };
  "rdfs:subClassOf"?: { "@id": string };
  "owl:unionOf"?: OwlUnion;
  "owl:inverseOf"?: { "@id": string };
  "owl:cardinality"?: number;
  "owl:maxCardinality"?: number;
  "vs:term_status"?: string;
  [key: string]: unknown;
}

type OwlUnion = { "@list": { "@id": string }[] } | { "@id": string }[];

interface VfClass {
  label: string;
  comment: string;
  status: string;
  subClassOf: string | null;
}

interface VfProperty {
  domains: string[];
  range: string | string[] | null;
  maxCard: number | null;
  type: "object" | "datatype";
  comment: string;
  label: string;
  inverseOf: string | null;
  status: string;
}

interface NamedIndividual {
  types: string[];
  label: string;
  comment: string;
  status: string;
  node: OwlNode;
}

interface LexiconTypeDef {
  type: string;
  format?: string;
  ref?: string;
  description?: string;
  knownValues?: string[];
  items?: LexiconTypeDef;
  maxGraphemes?: number;
}

interface LexiconDocument {
  lexicon: number;
  id: string;
  defs: Record<string, any>;
}

interface AuditReport {
  classesNotMapped: { class: string; label?: string; status?: string; nsid?: string; error?: string }[];
  missingFromLexicon: { nsid: string; property: string; rangeType: string; owlType: string; comment: string; status: string }[];
  extraInLexicon: { nsid: string; property: string; lexiconType: string; lexiconFormat?: string; description?: string }[];
  typeMismatches: { nsid: string; property: string; vfRange: string; lexiconType: string; lexiconFormat?: string; lexiconRef?: string; issues: string[] }[];
  summary: { total: number; missing: number; extra: number; mismatched: number };
}

// interfaces are already defined above (moved logic, but keeping interfaces)

// ─── helpers ────────────────────────────────────────────────────────────────

function getTypes(node: OwlNode): string[] {
  const t = node["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function stripVf(id: string | undefined): string {
  if (!id) return "";
  return id.replace(/^vf:/, "");
}

// Pre-index: named domain/range union classes (e.g., vf:ActionDomain → [EconomicEvent, Commitment, ...])
const namedUnionClasses: Record<string, string[]> = {};
for (const n of graph) {
  const id = stripVf(n["@id"]);
  const types: string[] = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"] as string];
  if (types.includes("owl:Class") && n["owl:unionOf"]) {
    let union: unknown = n["owl:unionOf"];
    if (union && typeof union === "object" && "@list" in (union as object)) union = (union as { "@list": unknown[] })["@list"];
    if (Array.isArray(union)) {
      namedUnionClasses[id] = union.map((u: { "@id": string }) => stripVf(u["@id"])).filter(Boolean);
    }
  }
}

function resolveUnion(ref: string): string[] {
  // If the ref is a named union class, return its members; otherwise return [ref]
  const name = stripVf(ref);
  if (namedUnionClasses[name]) return namedUnionClasses[name];
  return [name];
}

function getDomainClasses(node: OwlNode): string[] {
  const dom = node["rdfs:domain"] as { "@id"?: string; "owl:unionOf"?: OwlUnion } | undefined;
  if (!dom) return [];
  if (dom["@id"]) return resolveUnion(dom["@id"]);
  let union: unknown = dom["owl:unionOf"];
  if (!union) return [];
  if (typeof union === "object" && union !== null && "@list" in union) union = (union as { "@list": unknown[] })["@list"];
  if (!Array.isArray(union)) return [];
  return union.map((u: { "@id": string }) => stripVf(u["@id"])).filter(Boolean);
}

function getRangeId(node: OwlNode): string | string[] | null {
  const r = node["rdfs:range"] as { "@id"?: string; "owl:unionOf"?: OwlUnion } | undefined;
  if (!r) return null;
  if (r["@id"]) {
    const name = stripVf(r["@id"]);
    // If it's a named union range class, return array of constituent classes
    if (namedUnionClasses[name]) return namedUnionClasses[name];
    return name;
  }
  // Inline union range
  let union: unknown = r["owl:unionOf"];
  if (union) {
    if (typeof union === "object" && union !== null && "@list" in union) union = (union as { "@list": unknown[] })["@list"];
    if (Array.isArray(union)) {
      return union.map((u: { "@id": string }) => stripVf(u["@id"])).filter(Boolean);
    }
  }
  return null;
}

function getComment(node: OwlNode): string {
  const c = node["rdfs:comment"];
  if (!c) return "";
  if (typeof c === "string") return c;
  return (c as { "@value": string })["@value"] || "";
}

function getLabel(node: OwlNode): string {
  const l = node["rdfs:label"];
  if (!l) return "";
  if (typeof l === "string") return l;
  return (l as { "@value": string })["@value"] || "";
}

function getMaxCard(node: OwlNode): number | null {
  if (node["owl:cardinality"] !== undefined) return node["owl:cardinality"] as number;
  if (node["owl:maxCardinality"] !== undefined)
    return node["owl:maxCardinality"] as number;
  return null;
}

// ─── parse all nodes ────────────────────────────────────────────────────────

const classes: Record<string, VfClass> = {};
const properties: Record<string, VfProperty> = {};
const namedIndividuals: Record<string, NamedIndividual> = {};
const enumClasses = new Set<string>(); // classes that are enum value types

// Enum classes: these are used as ranges for Action effect properties
const ENUM_CLASS_NAMES = new Set<string>([
  "InputOutput",
  "CreateResource",
  "EventQuantity",
  "AccountingEffect",
  "OnhandEffect",
  "LocationEffect",
  "ContainedEffect",
  "AccountableEffect",
  "StageEffect",
  "StateEffect",
  "ProposalPurpose",
]);

// Classes to skip (not mapped to records)
const SKIP_CLASSES = new Set<string>([
  "Agent", // abstract, split into subtypes
  "Measure", // shared def object
  ...ENUM_CLASS_NAMES,
  // Named domain/range union classes (structural, not records)
  ...Object.keys(namedUnionClasses),
]);

for (const node of graph) {
  const id = stripVf(node["@id"]);
  const types = getTypes(node);

  if (types.includes("owl:Class")) {
    if (ENUM_CLASS_NAMES.has(id)) {
      enumClasses.add(id);
    } else {
      classes[id] = {
        label: getLabel(node),
        comment: getComment(node),
        status: (node["vs:term_status"] as string) || "stable",
        subClassOf: node["rdfs:subClassOf"]
          ? stripVf((node["rdfs:subClassOf"] as { "@id": string })["@id"])
          : null,
      };
    }
  }

  if (
    types.includes("owl:ObjectProperty") ||
    types.includes("owl:DatatypeProperty") ||
    types.includes("owl:DataTypeProperty")
  ) {
    const domains = getDomainClasses(node);
    // Expand Agent domain to subtypes
    const expandedDomains: string[] = [];
    for (const d of domains) {
      if (d === "Agent") {
        expandedDomains.push("Person", "Organization", "EcologicalAgent");
      } else {
        expandedDomains.push(d);
      }
    }

    const propType: "object" | "datatype" =
      types.includes("owl:ObjectProperty") ? "object" : "datatype";
    const range = getRangeId(node);
    const maxCard = getMaxCard(node);
    const inverseOf = node["owl:inverseOf"]
      ? stripVf((node["owl:inverseOf"] as { "@id": string })["@id"])
      : null;

    properties[id] = {
      domains: expandedDomains,
      range,
      maxCard,
      type: propType,
      comment: getComment(node),
      label: getLabel(node),
      inverseOf,
      status: (node["vs:term_status"] as string) || "stable",
    };
  }

  if (types.includes("owl:NamedIndividual")) {
    namedIndividuals[id] = {
      types: types.filter((t) => t !== "owl:NamedIndividual"),
      label: getLabel(node),
      comment: getComment(node),
      status: (node["vs:term_status"] as string) || "stable",
      node,
    };
  }
}

// ─── NSID mapping ───────────────────────────────────────────────────────────

 const NSID_TO_PATH: Record<string, string> = {};
for (const [cls, nsid] of Object.entries(CLASS_TO_NSID)) {
  const parts = nsid.split(".");
  const dir = parts.slice(1, -1).join("/");
  const file = parts[parts.length - 1] + ".json";
  NSID_TO_PATH[nsid] = join(OUTPUT_BASE, dir, file);
}

// ─── type mapping ───────────────────────────────────────────────────────────

// VF classes that are referenced by AT-URI (records)
const RECORD_CLASSES = new Set<string>(Object.keys(CLASS_TO_NSID));

// Agent subtypes referenced by DID
const AGENT_CLASSES = new Set<string>(["Agent", "Person", "Organization", "EcologicalAgent"]);

// Classify properties referenced by Action
const ACTION_EFFECT_PROPS = new Set<string>([
  "inputOutput",
  "pairsWith",
  "createResource",
  "eventQuantity",
  "accountingEffect",
  "onhandEffect",
  "locationEffect",
  "containedEffect",
  "accountableEffect",
  "stageEffect",
  "stateEffect",
]);

function rangeToLexiconType(propName: string, range: string | string[] | null, propType: "object" | "datatype", maxCard: number | null): LexiconTypeDef {
  // If range is an array (union), pick the first record class to determine format
  const effectiveRange: string | null = Array.isArray(range) ? range[0] : range;
  const isUnionRange: boolean = Array.isArray(range);

  // ── Special-case properties ──

  // imageList: ontology says xsd:anyURI (singular) but description says "comma separated list"
  // In AT Protocol, model as a proper array of URIs
  if (propName === "imageList") {
    return { type: "array", items: { type: "string", format: "uri" } };
  }

  // Classification arrays: stay as plain strings (mixed URIs and tags)
  if (
    propName === "classifiedAs" ||
    propName === "resourceClassifiedAs" ||
    propName === "processClassifiedAs"
  ) {
    if (maxCard === 1) return { type: "string" };
    return { type: "array", items: { type: "string" } };
  }

  // For union ranges pointing to records, determine if they're all VF records
  if (isUnionRange) {
    const allRecords = (range as string[]).every((r) => RECORD_CLASSES.has(r));
    const allAgents = (range as string[]).every((r) => AGENT_CLASSES.has(r));
    if (allAgents) {
      if (maxCard === 1) return { type: "string", format: "did" };
      return { type: "array", items: { type: "string", format: "did" } };
    }
    if (allRecords) {
      if (maxCard === 1) return { type: "string", format: "at-uri" };
      return { type: "array", items: { type: "string", format: "at-uri" } };
    }
  }

  // Enum ranges for Action effect properties
  if (effectiveRange && ENUM_CLASS_NAMES.has(effectiveRange)) {
    return {
      type: "string",
      description: `One of the ${effectiveRange} enum values`,
      knownValues: getEnumValues(effectiveRange),
    };
  }

  // Self-ref to Action (pairsWith)
  if (effectiveRange === "Action" && propName === "pairsWith") {
    return { type: "string", description: "Action identifier" };
  }

  // Measure → embedded object ref
  if (effectiveRange === "Measure") {
    return { type: "ref", ref: `${NS}.defs#measure` };
  }

  // Agent references → DID format
  if (effectiveRange && AGENT_CLASSES.has(effectiveRange)) {
    if (maxCard === 1) return { type: "string", format: "did" };
    return { type: "array", items: { type: "string", format: "did" } };
  }

  // Record references → AT-URI
  if (effectiveRange && RECORD_CLASSES.has(effectiveRange)) {
    if (maxCard === 1) return { type: "string", format: "at-uri" };
    return { type: "array", items: { type: "string", format: "at-uri" } };
  }

  // Datatype ranges
  if (propType === "datatype" || !effectiveRange || effectiveRange.startsWith("xsd:") || effectiveRange.startsWith("dtype:")) {
    const r = effectiveRange || "xsd:string";
    if (r === "xsd:boolean") return { type: "boolean" };
    if (r === "xsd:dateTimeStamp") return { type: "string", format: "datetime" };
    if (r === "xsd:anyURI") return { type: "string", format: "uri" };
    if (r === "xsd:string") return { type: "string" };
    if (r === "xsd:integer" || r === "xsd:int") return { type: "integer" };
    // Coordinates (lat/long/alt) — string representation since AT Protocol has no float
    if (r === "dtype:numericUnion") return { type: "string", description: "Decimal number as string (AT Protocol does not support floats)" };
    return { type: "string" };
  }

  // geosparql:Geometry → string serialization (testing, no AT Protocol equivalent)
  if (effectiveRange === "geosparql:Geometry") {
    return { type: "string", description: "GeoSPARQL geometry serialization" };
  }

  // Fallback
  return { type: "string" };
}

function getEnumValues(enumClassName: string): string[] {
  const values: string[] = [];
  for (const [id, ni] of Object.entries(namedIndividuals)) {
    if (ni.types.includes(`vf:${enumClassName}`)) {
      values.push(id);
    }
  }
  return values.sort();
}

// ─── build lexicon per class ────────────────────────────────────────────────

function buildRecordLexicon(className: string): LexiconDocument | null {
  const nsid = CLASS_TO_NSID[className];
  if (!nsid) return null;

  const classInfo = classes[className];
  if (!classInfo && className !== "Unit") return null;

  const info: VfClass = classInfo || {
    label: className,
    comment: "",
    status: "stable",
    subClassOf: null,
  };

  // Gather all properties for this class
  const classProps: Record<string, LexiconTypeDef> = {};
  for (const [propName, prop] of Object.entries(properties)) {
    if (!prop.domains.includes(className)) continue;
    // Skip Action effect properties on non-Action classes
    if (className !== "Action" && ACTION_EFFECT_PROPS.has(propName)) continue;

    const lexType = rangeToLexiconType(
      propName,
      prop.range,
      prop.type,
      prop.maxCard
    );
    const propDef: LexiconTypeDef = { ...lexType };
    if (prop.comment) propDef.description = prop.comment;
    // String constraints
    if (propDef.type === "string" && !propDef.format && !propDef.knownValues && !propDef.ref) {
      if (propName === "note") propDef.maxGraphemes = 10000;
      if (propName === "name") propDef.maxGraphemes = 640;
    }
    classProps[propName] = propDef;
  }

  // Build the required array (properties with owl:cardinality = 1)
  const required: string[] = [];
  for (const [propName, prop] of Object.entries(properties)) {
    if (!prop.domains.includes(className)) continue;
    if (className !== "Action" && ACTION_EFFECT_PROPS.has(propName)) continue;
    const node = graph.find((n) => stripVf(n["@id"]) === propName);
    if (node && node["owl:cardinality"] === 1) {
      required.push(propName);
    }
  }

  const recordDef: Record<string, any> = {
    type: "record",
    description: info.comment || `${info.label} record`,
    key: "tid",
    record: {
      type: "object",
      required: required.length > 0 ? required : undefined,
      properties: classProps,
    },
  };

  // Clean up undefined
  if (!recordDef.record.required) delete recordDef.record.required;

  return {
    lexicon: 1,
    id: nsid,
    defs: {
      main: recordDef,
    },
  };
}

// ─── special: Action record with named individuals ──────────────────────────

function buildActionLexicon(): LexiconDocument | null {
  const base = buildRecordLexicon("Action");
  if (!base) return null;

  // Collect action names as knownValues
  const actionNames: string[] = [];
  for (const [id, ni] of Object.entries(namedIndividuals)) {
    if (ni.types.includes("vf:Action")) {
      actionNames.push(id);
    }
  }
  actionNames.sort();

  // Add an "id" field that identifies which action this is
  base.defs.main.record.properties = {
    actionId: {
      type: "string",
      description:
        "The canonical identifier for this action type",
      knownValues: actionNames,
    },
    ...base.defs.main.record.properties,
  };

  base.defs.main.record.required = ["actionId", "label"];

  return base;
}

// ─── special: shared defs (Measure) ─────────────────────────────────────────

function buildDefsLexicon(): LexiconDocument {
  return {
    lexicon: 1,
    id: `${NS}.defs`,
    defs: {
      measure: {
        type: "object",
        description:
          "A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.",
        required: ["hasNumericalValue"],
        properties: {
          hasNumericalValue: {
            type: "integer",
            description: "The numeric value (numerator).",
          },
          hasDenominator: {
            type: "integer",
            description:
              "The denominator for fractional values. Default 1 if omitted.",
          },
          hasUnit: {
            type: "string",
            format: "at-uri",
            description: "Reference to a Unit record.",
          },
        },
      },
    },
  };
}

// ─── generate all ───────────────────────────────────────────────────────────

const allLexicons: Record<string, LexiconDocument | null> = {};

// 1. Shared defs
allLexicons[`${NS}.defs`] = buildDefsLexicon();

// 2. All record types
for (const className of Object.keys(CLASS_TO_NSID)) {
  if (SKIP_CLASSES.has(className)) continue;
  if (className === "Action") {
    allLexicons[CLASS_TO_NSID[className]] = buildActionLexicon();
  } else {
    allLexicons[CLASS_TO_NSID[className]] = buildRecordLexicon(className);
  }
}

// ─── mode dispatch ──────────────────────────────────────────────────────────

if (AUDIT_MODE) {
  auditLexicons();
} else {
  writeLexicons();
}

// ─── write files ────────────────────────────────────────────────────────────

 function writeLexicons(): void {
  // Write defs if they were generated
  if (allLexicons[`${NS}.defs`]) {
    const defsPath = join(ROOT, OUTPUT_BASE, "defs.json");
    mkdirSync(dirname(defsPath), { recursive: true });
    writeFileSync(defsPath, JSON.stringify(allLexicons[`${NS}.defs`], null, 2) + "\n");
    console.log(`✓ ${defsPath}`);
  }

  for (const [nsid, lexicon] of Object.entries(allLexicons)) {
    if (nsid === `${NS}.defs`) continue;
    if (!lexicon) {
      console.log(`✗ ${nsid} — failed to generate`);
      continue;
    }
    const relPath = NSID_TO_PATH[nsid];
    const fullPath = join(ROOT, relPath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, JSON.stringify(lexicon, null, 2) + "\n");
    console.log(`✓ ${fullPath}`);
  }

  // Summary
  console.log("\n=== Summary ===");
  const fileCount = Object.keys(allLexicons).length;
  console.log(`Generated ${fileCount} lexicon files`);

  for (const [nsid, lex] of Object.entries(allLexicons)) {
    if (!lex?.defs?.main?.record?.properties) continue;
    const propCount = Object.keys(lex.defs.main.record.properties).length;
    console.log(`  ${nsid}: ${propCount} properties`);
  }
}

// ─── audit mode ─────────────────────────────────────────────────────────────

 function loadOnDiskLexicons(): Record<string, any> {
  const lexiconDir = join(ROOT, OUTPUT_BASE);
  const result: Record<string, any> = {};
  if (!existsSync(lexiconDir)) return result;

  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith(".json")) {
        const data = JSON.parse(readFileSync(fullPath, "utf-8"));
        if (data.id) {
          result[data.id] = data;
        }
      }
    }
  }

  walk(lexiconDir);
  return result;
}

function expectedLexiconType(rangeType: string | null, owlType: string | string[]): { type: string; format?: string; ref?: string; note?: string; raw?: string | null } {
  if (rangeType === "xsd:string") return { type: "string" };
  if (rangeType === "xsd:boolean") return { type: "boolean" };
  if (rangeType === "xsd:dateTimeStamp") return { type: "string", format: "datetime" };
  if (rangeType === "xsd:anyURI") return { type: "string", format: "uri" };
  if (rangeType === "xsd:decimal" || rangeType === "xsd:float" || rangeType === "dtype:numericUnion") {
    return { type: "ref", ref: `${NS}.defs#measure` };
  }
  if (rangeType === "xsd:integer" || rangeType === "xsd:int") return { type: "integer" };

  // Agent references → DID
  if (AGENT_CLASSES.has(rangeType || "")) return { type: "string", format: "did" };

  // Measure → embedded ref
  if (rangeType === "Measure" || rangeType === "om:Measure") return { type: "ref", ref: `${NS}.defs#measure` };

  // Action self-ref (pairsWith)
  if (rangeType === "Action") return { type: "string", note: "knownValues enum or at-uri" };

  // Enum classes → knownValues
  if (ENUM_CLASS_NAMES.has(rangeType || "")) return { type: "string", note: "enum as knownValues" };

  // Record references → AT-URI
  if (RECORD_CLASSES.has(rangeType || "")) return { type: "string", format: "at-uri" };

  // Geometry
  if (rangeType === "geosparql:Geometry") return { type: "string", note: "geometry" };

  // time:Duration
  if (rangeType === "time:Duration") return { type: "ref", ref: `${NS}.defs#measure` };

  return { type: "unknown", raw: rangeType };
}

function auditLexicons(): void {
  const onDisk = loadOnDiskLexicons();
  const allNsids = new Set<string>(Object.keys(onDisk));

  // Build expected properties per class from parsed ontology data
  const expectedByClass: Record<string, Record<string, VfProperty>> = {};
  for (const cls of Object.keys(CLASS_TO_NSID)) {
    expectedByClass[cls] = {};
  }
  for (const [propName, prop] of Object.entries(properties)) {
    for (const domainClass of prop.domains) {
      if (expectedByClass[domainClass]) {
        expectedByClass[domainClass][propName] = prop;
      }
    }
  }

  const report: AuditReport = {
    classesNotMapped: [],
    missingFromLexicon: [],
    extraInLexicon: [],
    typeMismatches: [],
    summary: { total: 0, missing: 0, extra: 0, mismatched: 0 },
  };

  // ── Header ──
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║         VF ONTOLOGY → AT PROTOCOL LEXICON AUDIT REPORT         ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ── Section 1: Unmapped classes ──
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  1. CLASSES IN VF.JSON NOT MAPPED TO LEXICONS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const nsidClassNames = new Set<string>(Object.keys(CLASS_TO_NSID));
  for (const cls of Object.keys(classes)) {
    if (!nsidClassNames.has(cls) && !SKIP_CLASSES.has(cls)) {
      report.classesNotMapped.push({
        class: cls,
        label: classes[cls].label,
        status: classes[cls].status,
      });
    }
  }

  if (report.classesNotMapped.length === 0) {
    console.log("  ✓ All classes mapped (or intentionally skipped)");
  } else {
    for (const item of report.classesNotMapped) {
      console.log(`  ✗ ${item.class} (${item.label || ""}) [${item.status || ""}]`);
    }
  }
  console.log(`  Intentionally skipped: ${[...SKIP_CLASSES].join(", ")}`);
  console.log();

  // ── Sections 2–4: Per-class property comparison ──
  for (const [className, nsid] of Object.entries(CLASS_TO_NSID)) {
    const expected = expectedByClass[className] || {};
    const lexicon = onDisk[nsid];

    if (!lexicon) {
      report.classesNotMapped.push({ class: className, nsid, error: "LEXICON FILE MISSING" });
      continue;
    }

    const record = lexicon.defs?.main?.record;
    if (!record) continue;

    const lexiconProps: Record<string, any> = record.properties || {};
    const expectedPropNames = Object.keys(expected);
    const lexiconPropNames = Object.keys(lexiconProps);

    // Missing properties
    for (const propName of expectedPropNames) {
      report.summary.total++;
      if (!lexiconProps[propName]) {
        const prop = expected[propName];
        report.missingFromLexicon.push({
          nsid,
          property: propName,
          rangeType: Array.isArray(prop.range) ? prop.range.join(" | ") : (prop.range || ""),
          owlType: prop.type,
          comment: prop.comment,
          status: prop.status,
        });
        report.summary.missing++;
      }
    }

    // Extra properties
    for (const propName of lexiconPropNames) {
      if (!expected[propName]) {
        const lexProp = lexiconProps[propName];
        report.extraInLexicon.push({
          nsid,
          property: propName,
          lexiconType: lexProp.type,
          lexiconFormat: lexProp.format,
          description: lexProp.description,
        });
        report.summary.extra++;
      }
    }

    // Type mismatches
    for (const propName of expectedPropNames) {
      if (!lexiconProps[propName]) continue;
      const prop = expected[propName];
      const lexProp = lexiconProps[propName];
      const rangeStr: string = Array.isArray(prop.range) ? prop.range[0] : (prop.range || "");
      const expType = expectedLexiconType(rangeStr, prop.type);
      const issues: string[] = [];

      if (expType.type !== "unknown") {
        if (lexProp.type === "array") {
          // Arrays are acceptable for multi-valued properties
        } else if (expType.type === "ref" && lexProp.type === "ref") {
          if (expType.ref && lexProp.ref !== expType.ref) {
            issues.push(`ref mismatch: expected ${expType.ref}, got ${lexProp.ref}`);
          }
        } else if (expType.type === "string" && lexProp.type === "string") {
          if (expType.format && lexProp.format !== expType.format) {
            issues.push(`format mismatch: expected ${expType.format}, got ${lexProp.format || "none"}`);
          }
        } else if (expType.type !== lexProp.type && lexProp.type !== "array") {
          if (!expType.note) {
            issues.push(`type mismatch: expected ${expType.type}, got ${lexProp.type}`);
          }
        }
      }

      if (issues.length > 0) {
        report.typeMismatches.push({
          nsid,
          property: propName,
          vfRange: rangeStr,
          lexiconType: lexProp.type,
          lexiconFormat: lexProp.format,
          lexiconRef: lexProp.ref,
          issues,
        });
        report.summary.mismatched++;
      }
    }
  }

  // Print section 2
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  2. PROPERTIES IN VF.JSON MISSING FROM LEXICONS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (report.missingFromLexicon.length === 0) {
    console.log("  ✓ No missing properties");
  } else {
    const grouped: Record<string, typeof report.missingFromLexicon> = {};
    for (const item of report.missingFromLexicon) {
      if (!grouped[item.nsid]) grouped[item.nsid] = [];
      grouped[item.nsid].push(item);
    }
    for (const [nsid, items] of Object.entries(grouped)) {
      console.log(`\n  ${nsid}:`);
      for (const item of items) {
        console.log(`    ✗ ${item.property}`);
        console.log(`      Range: ${item.rangeType} | OWL: ${item.owlType} | Status: ${item.status}`);
        console.log(`      "${item.comment}"`);
      }
    }
  }
  console.log();

  // Print section 3
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  3. PROPERTIES IN LEXICONS NOT IN VF.JSON (ADDITIONS)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (report.extraInLexicon.length === 0) {
    console.log("  ✓ No extra properties");
  } else {
    const grouped: Record<string, typeof report.extraInLexicon> = {};
    for (const item of report.extraInLexicon) {
      if (!grouped[item.nsid]) grouped[item.nsid] = [];
      grouped[item.nsid].push(item);
    }
    for (const [nsid, items] of Object.entries(grouped)) {
      console.log(`\n  ${nsid}:`);
      for (const item of items) {
        console.log(`    + ${item.property} (${item.lexiconType}${item.lexiconFormat ? `, format: ${item.lexiconFormat}` : ""})`);
        console.log(`      "${item.description}"`);
      }
    }
  }
  console.log();

  // Print section 4
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  4. TYPE/FORMAT MISMATCHES");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (report.typeMismatches.length === 0) {
    console.log("  ✓ No type mismatches");
  } else {
    for (const item of report.typeMismatches) {
      console.log(`  ✗ ${item.nsid}.${item.property}`);
      console.log(`    VF range: ${item.vfRange}`);
      console.log(`    Lexicon: type=${item.lexiconType}, format=${item.lexiconFormat || "none"}, ref=${item.lexiconRef || "none"}`);
      for (const issue of item.issues) {
        console.log(`    → ${issue}`);
      }
    }
  }
  console.log();

  // ── Section 5: Action named individuals ──
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  5. ACTION NAMED INDIVIDUALS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const vfActionIds: string[] = Object.entries(namedIndividuals)
    .filter(([, ni]) => ni.types.includes("vf:Action"))
    .map(([id]) => id);
  const vfActionLabels: string[] = vfActionIds.map((id) => namedIndividuals[id].label || id);

  const actionLexicon = onDisk[`${NS}.knowledge.action`];
  const actionProps: Record<string, any> = actionLexicon?.defs?.main?.record?.properties || {};
  const actionKnownValues: string[] = actionProps.actionId?.knownValues || [];

  console.log(`  VF actions (${vfActionIds.length}): ${vfActionLabels.join(", ")}`);
  console.log(`  Lexicon actionId knownValues (${actionKnownValues.length}): ${actionKnownValues.join(", ")}`);

  // Check named individual properties vs lexicon properties
  const actionNamedProps = new Set<string>();
  for (const actionId of vfActionIds) {
    const node = namedIndividuals[actionId].node;
    for (const key of Object.keys(node)) {
      if (key.startsWith("vf:")) {
        actionNamedProps.add(key.replace("vf:", ""));
      }
    }
  }

  console.log(`\n  Action properties in vf.json named individuals: ${[...actionNamedProps].join(", ")}`);
  console.log(`  Action properties in lexicon: ${Object.keys(actionProps).join(", ")}`);

  const missingActionProps: string[] = [...actionNamedProps].filter((p) => !actionProps[p]);
  const extraActionProps: string[] = Object.keys(actionProps).filter((p) => !actionNamedProps.has(p) && p !== "actionId");
  if (missingActionProps.length > 0) {
    console.log(`  ✗ Missing from action lexicon: ${missingActionProps.join(", ")}`);
  }
  if (extraActionProps.length > 0) {
    console.log(`  + Extra in action lexicon: ${extraActionProps.join(", ")}`);
  }
  console.log();

  // ── Section 6: Measure definition ──
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  6. VF.DEFS MEASURE DEFINITION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const defsLexicon = onDisk[`${NS}.defs`];
  const measureDef = defsLexicon?.defs?.measure;
  const measureExpectedProps: string[] = ["hasNumericalValue", "hasDenominator", "hasUnit"];

  if (measureDef) {
    const measureProps: string[] = Object.keys(measureDef.properties || {});
    console.log(`  Defined properties: ${measureProps.join(", ")}`);
    console.log(`  Expected: ${measureExpectedProps.join(", ")}`);
    const missingMeasure: string[] = measureExpectedProps.filter((p) => !measureDef.properties[p]);
    if (missingMeasure.length > 0) {
      console.log(`  ✗ Missing: ${missingMeasure.join(", ")}`);
    } else {
      console.log("  ✓ All measure properties present");
    }
  } else {
    console.log("  ✗ vf.defs#measure not found!");
  }
  console.log();

  // ── Section 7: Cross-reference integrity ──
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  7. CROSS-REFERENCE INTEGRITY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  let brokenRefs = 0;
  for (const [nsid, lex] of Object.entries(onDisk)) {
    // Check main record properties
    const props: Record<string, any> = lex.defs?.main?.record?.properties || {};
    for (const [propName, propDef] of Object.entries(props) as [string, any][]) {
      if (propDef.ref) {
        const [refNsid] = propDef.ref.split("#");
        if (!allNsids.has(refNsid)) {
          console.log(`  ✗ ${nsid}.${propName}: ref "${propDef.ref}" → ${refNsid} NOT FOUND`);
          brokenRefs++;
        }
      }
      if (propDef.items?.ref) {
        const [refNsid] = propDef.items.ref.split("#");
        if (!allNsids.has(refNsid)) {
          console.log(`  ✗ ${nsid}.${propName}[]: ref "${propDef.items.ref}" → ${refNsid} NOT FOUND`);
          brokenRefs++;
        }
      }
    }
    // Check non-main defs
    for (const [defName, def] of Object.entries(lex.defs || {}) as [string, any][]) {
      if (defName === "main") continue;
      const defProps: Record<string, any> = def.properties || {};
      for (const [propName, propDef] of Object.entries(defProps) as [string, any][]) {
        if (propDef.ref) {
          const [refNsid] = propDef.ref.split("#");
          if (!allNsids.has(refNsid)) {
            console.log(`  ✗ ${nsid}#${defName}.${propName}: ref "${propDef.ref}" → ${refNsid} NOT FOUND`);
            brokenRefs++;
          }
        }
      }
    }
  }
  if (brokenRefs === 0) {
    console.log("  ✓ All refs resolve to existing lexicons");
  }
  console.log();

  // ── Summary ──
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SUMMARY");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`  Total VF properties checked: ${report.summary.total}`);
  console.log(`  Missing from lexicons:       ${report.summary.missing}`);
  console.log(`  Extra in lexicons:           ${report.summary.extra}`);
  console.log(`  Type/format mismatches:      ${report.summary.mismatched}`);
  console.log(`  Unmapped classes:            ${report.classesNotMapped.length}`);
  console.log(`  Broken refs:                 ${brokenRefs}`);
  console.log();
}
