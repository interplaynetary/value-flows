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

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";

const AUDIT_MODE = Bun.argv.includes("--audit");

const ROOT = join(import.meta.dir, "..");
const vfJson = JSON.parse(readFileSync(join(ROOT, "specs/vf.json"), "utf-8"));
const graph = vfJson["@graph"];

// ─── helpers ────────────────────────────────────────────────────────────────

function getTypes(node) {
  const t = node["@type"];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
}

function stripVf(id) {
  if (!id) return id;
  return id.replace(/^vf:/, "");
}

// Pre-index: named domain/range union classes (e.g., vf:ActionDomain → [EconomicEvent, Commitment, ...])
const namedUnionClasses = {};
for (const n of graph) {
  const id = stripVf(n["@id"]);
  const types = Array.isArray(n["@type"]) ? n["@type"] : [n["@type"]];
  if (types.includes("owl:Class") && n["owl:unionOf"]) {
    let union = n["owl:unionOf"];
    if (union["@list"]) union = union["@list"];
    if (Array.isArray(union)) {
      namedUnionClasses[id] = union.map((u) => stripVf(u["@id"])).filter(Boolean);
    }
  }
}

function resolveUnion(ref) {
  // If the ref is a named union class, return its members; otherwise return [ref]
  const name = stripVf(ref);
  if (namedUnionClasses[name]) return namedUnionClasses[name];
  return [name];
}

function getDomainClasses(node) {
  const dom = node["rdfs:domain"];
  if (!dom) return [];
  if (dom["@id"]) return resolveUnion(dom["@id"]);
  let union = dom["owl:unionOf"];
  if (!union) return [];
  if (union["@list"]) union = union["@list"];
  if (!Array.isArray(union)) return [];
  return union.map((u) => stripVf(u["@id"])).filter(Boolean);
}

function getRangeId(node) {
  const r = node["rdfs:range"];
  if (!r) return null;
  if (r["@id"]) {
    const name = stripVf(r["@id"]);
    // If it's a named union range class, return array of constituent classes
    if (namedUnionClasses[name]) return namedUnionClasses[name];
    return name;
  }
  // Inline union range
  let union = r["owl:unionOf"];
  if (union) {
    if (union["@list"]) union = union["@list"];
    if (Array.isArray(union)) {
      return union.map((u) => stripVf(u["@id"])).filter(Boolean);
    }
  }
  return null;
}

function getComment(node) {
  const c = node["rdfs:comment"];
  if (!c) return "";
  if (typeof c === "string") return c;
  return c["@value"] || "";
}

function getLabel(node) {
  const l = node["rdfs:label"];
  if (!l) return "";
  if (typeof l === "string") return l;
  return l["@value"] || "";
}

function getMaxCard(node) {
  if (node["owl:cardinality"] !== undefined) return node["owl:cardinality"];
  if (node["owl:maxCardinality"] !== undefined)
    return node["owl:maxCardinality"];
  return null;
}

// ─── parse all nodes ────────────────────────────────────────────────────────

const classes = {}; // className -> { label, comment, status, subClassOf }
const properties = {}; // propName -> { domains, range, maxCard, type, comment, label, inverseOf }
const namedIndividuals = {}; // id -> { types, ... }
const enumClasses = new Set(); // classes that are enum value types

// Enum classes: these are used as ranges for Action effect properties
const ENUM_CLASS_NAMES = new Set([
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
const SKIP_CLASSES = new Set([
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
        status: node["vs:term_status"] || "stable",
        subClassOf: node["rdfs:subClassOf"]
          ? stripVf(node["rdfs:subClassOf"]["@id"])
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
    const expandedDomains = [];
    for (const d of domains) {
      if (d === "Agent") {
        expandedDomains.push("Person", "Organization", "EcologicalAgent");
      } else {
        expandedDomains.push(d);
      }
    }

    const propType =
      types.includes("owl:ObjectProperty") ? "object" : "datatype";
    const range = getRangeId(node);
    const maxCard = getMaxCard(node);
    const inverseOf = node["owl:inverseOf"]
      ? stripVf(node["owl:inverseOf"]["@id"])
      : null;

    properties[id] = {
      domains: expandedDomains,
      range,
      maxCard,
      type: propType,
      comment: getComment(node),
      label: getLabel(node),
      inverseOf,
      status: node["vs:term_status"] || "stable",
    };
  }

  if (types.includes("owl:NamedIndividual")) {
    namedIndividuals[id] = {
      types: types.filter((t) => t !== "owl:NamedIndividual"),
      label: getLabel(node),
      comment: getComment(node),
      status: node["vs:term_status"] || "stable",
      node,
    };
  }
}

// ─── NSID mapping ───────────────────────────────────────────────────────────

const CLASS_TO_NSID = {
  ResourceSpecification: "vf.knowledge.resourceSpecification",
  ProcessSpecification: "vf.knowledge.processSpecification",
  Action: "vf.knowledge.action",
  Recipe: "vf.knowledge.recipe",
  RecipeProcess: "vf.knowledge.recipeProcess",
  RecipeFlow: "vf.knowledge.recipeFlow",
  RecipeExchange: "vf.knowledge.recipeExchange",
  SpatialThing: "vf.knowledge.spatialThing",
  Unit: "vf.knowledge.unit",
  Plan: "vf.planning.plan",
  Intent: "vf.planning.intent",
  Proposal: "vf.planning.proposal",
  ProposalList: "vf.planning.proposalList",
  Commitment: "vf.planning.commitment",
  Agreement: "vf.planning.agreement",
  AgreementBundle: "vf.planning.agreementBundle",
  Claim: "vf.planning.claim",
  Process: "vf.planning.process",
  Person: "vf.observation.person",
  Organization: "vf.observation.organization",
  EcologicalAgent: "vf.observation.ecologicalAgent",
  EconomicResource: "vf.observation.economicResource",
  EconomicEvent: "vf.observation.economicEvent",
  BatchLotRecord: "vf.observation.batchLotRecord",
};

const NSID_TO_PATH = {};
for (const [cls, nsid] of Object.entries(CLASS_TO_NSID)) {
  const parts = nsid.split(".");
  const dir = parts.slice(1, -1).join("/");
  const file = parts[parts.length - 1] + ".json";
  NSID_TO_PATH[nsid] = join("lexicons", "vf", dir, file);
}

// ─── type mapping ───────────────────────────────────────────────────────────

// VF classes that are referenced by AT-URI (records)
const RECORD_CLASSES = new Set(Object.keys(CLASS_TO_NSID));

// Agent subtypes referenced by DID
const AGENT_CLASSES = new Set(["Agent", "Person", "Organization", "EcologicalAgent"]);

// Classify properties referenced by Action
const ACTION_EFFECT_PROPS = new Set([
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

function rangeToLexiconType(propName, range, propType, maxCard) {
  // If range is an array (union), pick the first record class to determine format
  const effectiveRange = Array.isArray(range) ? range[0] : range;
  const isUnionRange = Array.isArray(range);

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
    const allRecords = range.every((r) => RECORD_CLASSES.has(r));
    const allAgents = range.every((r) => AGENT_CLASSES.has(r));
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
  if (ENUM_CLASS_NAMES.has(effectiveRange)) {
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
    return { type: "ref", ref: "vf.defs#measure" };
  }

  // Agent references → DID format
  if (AGENT_CLASSES.has(effectiveRange)) {
    if (maxCard === 1) return { type: "string", format: "did" };
    return { type: "array", items: { type: "string", format: "did" } };
  }

  // Record references → AT-URI
  if (RECORD_CLASSES.has(effectiveRange)) {
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

function getEnumValues(enumClassName) {
  const values = [];
  for (const [id, ni] of Object.entries(namedIndividuals)) {
    if (ni.types.includes(`vf:${enumClassName}`)) {
      values.push(id);
    }
  }
  return values.sort();
}

// ─── build lexicon per class ────────────────────────────────────────────────

function buildRecordLexicon(className) {
  const nsid = CLASS_TO_NSID[className];
  if (!nsid) return null;

  const classInfo = classes[className];
  if (!classInfo && className !== "Unit") return null;

  const info = classInfo || {
    label: className,
    comment: "",
    status: "stable",
  };

  // Gather all properties for this class
  const classProps = {};
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
    const propDef = { ...lexType };
    if (prop.comment) propDef.description = prop.comment;
    // String constraints
    if (propDef.type === "string" && !propDef.format && !propDef.knownValues && !propDef.ref) {
      if (propName === "note") propDef.maxGraphemes = 10000;
      if (propName === "name") propDef.maxGraphemes = 640;
    }
    classProps[propName] = propDef;
  }

  // Build the required array (properties with owl:cardinality = 1)
  const required = [];
  for (const [propName, prop] of Object.entries(properties)) {
    if (!prop.domains.includes(className)) continue;
    if (className !== "Action" && ACTION_EFFECT_PROPS.has(propName)) continue;
    const card = prop.maxCard;
    // Only cardinality: 1 (not maxCardinality) implies required
    const node = graph.find((n) => stripVf(n["@id"]) === propName);
    if (node && node["owl:cardinality"] === 1) {
      required.push(propName);
    }
  }

  const recordDef = {
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

function buildActionLexicon() {
  const base = buildRecordLexicon("Action");
  if (!base) return null;

  // Add label property (from owl:DataTypeProperty, domain Action)
  // Already handled by property iteration

  // Collect action names as knownValues
  const actionNames = [];
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

function buildDefsLexicon() {
  return {
    lexicon: 1,
    id: "vf.defs",
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

const allLexicons = {};

// 1. Shared defs
allLexicons["vf.defs"] = buildDefsLexicon();

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

function writeLexicons() {
  // Write defs
  const defsPath = join(ROOT, "lexicons", "vf", "defs.json");
  writeFileSync(defsPath, JSON.stringify(allLexicons["vf.defs"], null, 2) + "\n");
  console.log(`✓ ${defsPath}`);

  for (const [nsid, lexicon] of Object.entries(allLexicons)) {
    if (nsid === "vf.defs") continue;
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
  const lexiconDir = join(ROOT, "lexicons", "vf");
  const result: Record<string, any> = {};

  function walk(dir: string) {
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

function expectedLexiconType(rangeType: string | null, owlType: string | string[]) {
  if (rangeType === "xsd:string") return { type: "string" };
  if (rangeType === "xsd:boolean") return { type: "boolean" };
  if (rangeType === "xsd:dateTimeStamp") return { type: "string", format: "datetime" };
  if (rangeType === "xsd:anyURI") return { type: "string", format: "uri" };
  if (rangeType === "xsd:decimal" || rangeType === "xsd:float" || rangeType === "dtype:numericUnion") {
    return { type: "ref", ref: "vf.defs#measure" };
  }
  if (rangeType === "xsd:integer" || rangeType === "xsd:int") return { type: "integer" };

  // Agent references → DID
  if (AGENT_CLASSES.has(rangeType || "")) return { type: "string", format: "did" };

  // Measure → embedded ref
  if (rangeType === "Measure" || rangeType === "om:Measure") return { type: "ref", ref: "vf.defs#measure" };

  // Action self-ref (pairsWith)
  if (rangeType === "Action") return { type: "string", note: "knownValues enum or at-uri" };

  // Enum classes → knownValues
  if (ENUM_CLASS_NAMES.has(rangeType || "")) return { type: "string", note: "enum as knownValues" };

  // Record references → AT-URI
  if (RECORD_CLASSES.has(rangeType || "")) return { type: "string", format: "at-uri" };

  // Geometry
  if (rangeType === "geosparql:Geometry") return { type: "string", note: "geometry" };

  // time:Duration
  if (rangeType === "time:Duration") return { type: "ref", ref: "vf.defs#measure" };

  return { type: "unknown", raw: rangeType };
}

function auditLexicons() {
  const onDisk = loadOnDiskLexicons();
  const allNsids = new Set(Object.keys(onDisk));

  // Build expected properties per class from parsed ontology data
  const expectedByClass: Record<string, Record<string, any>> = {};
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

  const report = {
    classesNotMapped: [] as any[],
    missingFromLexicon: [] as any[],
    extraInLexicon: [] as any[],
    typeMismatches: [] as any[],
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

  const nsidClassNames = new Set(Object.keys(CLASS_TO_NSID));
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

    const lexiconProps = record.properties || {};
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
          rangeType: Array.isArray(prop.range) ? prop.range.join(" | ") : prop.range,
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
      const rangeStr = Array.isArray(prop.range) ? prop.range[0] : prop.range;
      const expType = expectedLexiconType(rangeStr, prop.type);
      const issues: string[] = [];

      if (expType.type !== "unknown") {
        if (lexProp.type === "array") {
          // Arrays are acceptable for multi-valued properties
        } else if (expType.type === "ref" && lexProp.type === "ref") {
          if ((expType as any).ref && lexProp.ref !== (expType as any).ref) {
            issues.push(`ref mismatch: expected ${(expType as any).ref}, got ${lexProp.ref}`);
          }
        } else if (expType.type === "string" && lexProp.type === "string") {
          if ((expType as any).format && lexProp.format !== (expType as any).format) {
            issues.push(`format mismatch: expected ${(expType as any).format}, got ${lexProp.format || "none"}`);
          }
        } else if (expType.type !== lexProp.type && lexProp.type !== "array") {
          if (!(expType as any).note) {
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
    const grouped: Record<string, any[]> = {};
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
    const grouped: Record<string, any[]> = {};
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

  const vfActionIds = Object.entries(namedIndividuals)
    .filter(([, ni]) => ni.types.includes("vf:Action"))
    .map(([id]) => id);
  const vfActionLabels = vfActionIds.map((id) => namedIndividuals[id].label || id);

  const actionLexicon = onDisk["vf.knowledge.action"];
  const actionProps = actionLexicon?.defs?.main?.record?.properties || {};
  const actionKnownValues = actionProps.actionId?.knownValues || [];

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

  const missingActionProps = [...actionNamedProps].filter((p) => !actionProps[p]);
  const extraActionProps = Object.keys(actionProps).filter((p) => !actionNamedProps.has(p) && p !== "actionId");
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

  const defsLexicon = onDisk["vf.defs"];
  const measureDef = defsLexicon?.defs?.measure;
  const measureExpectedProps = ["hasNumericalValue", "hasDenominator", "hasUnit"];

  if (measureDef) {
    const measureProps = Object.keys(measureDef.properties || {});
    console.log(`  Defined properties: ${measureProps.join(", ")}`);
    console.log(`  Expected: ${measureExpectedProps.join(", ")}`);
    const missingMeasure = measureExpectedProps.filter((p) => !measureDef.properties[p]);
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
    const props = lex.defs?.main?.record?.properties || {};
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
      const defProps = def.properties || {};
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
