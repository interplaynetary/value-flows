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

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const ROOT = join(import.meta.dir, "..");
const vfJson = JSON.parse(readFileSync(join(ROOT, "vf.json"), "utf-8"));
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

function getDomainClasses(node) {
  const dom = node["rdfs:domain"];
  if (!dom) return [];
  if (dom["@id"]) return [stripVf(dom["@id"])];
  let union = dom["owl:unionOf"];
  if (!union) return [];
  if (union["@list"]) union = union["@list"];
  if (!Array.isArray(union)) return [];
  return union.map((u) => stripVf(u["@id"])).filter(Boolean);
}

function getRangeId(node) {
  const r = node["rdfs:range"];
  if (!r) return null;
  if (r["@id"]) return stripVf(r["@id"]);
  // Union range: return all classes
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
  "PairsWith",
]);

// Classes to skip (not mapped to records)
const SKIP_CLASSES = new Set([
  "Agent", // abstract, split into subtypes
  "Measure", // shared def object
  "ExternalLink", // not a VF type
  ...ENUM_CLASS_NAMES,
]);

// Typo fix map
const TYPO_FIX = { Agreenent: "Agreement" };

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
    const domains = getDomainClasses(node).map((d) => TYPO_FIX[d] || d);
    // Expand Agent domain to subtypes
    const expandedDomains = [];
    for (const d of domains) {
      if (d === "Agent") {
        expandedDomains.push("Person", "Organization", "EcologicalAgent");
      } else if (d === "ExternalLink") {
        // skip
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
  Unit: "vf.knowledge.unit",
  Recipe: "vf.recipe.recipe",
  RecipeProcess: "vf.recipe.recipeProcess",
  RecipeFlow: "vf.recipe.recipeFlow",
  RecipeExchange: "vf.recipe.recipeExchange",
  Plan: "vf.planning.plan",
  Intent: "vf.planning.intent",
  Proposal: "vf.proposal.proposal",
  ProposalList: "vf.proposal.proposalList",
  Commitment: "vf.planning.commitment",
  Agreement: "vf.agreement.agreement",
  AgreementBundle: "vf.agreement.agreementBundle",
  Claim: "vf.planning.claim",
  Process: "vf.planning.process",
  Person: "vf.agent.person",
  Organization: "vf.agent.organization",
  EcologicalAgent: "vf.agent.ecologicalAgent",
  EconomicResource: "vf.observation.economicResource",
  EconomicEvent: "vf.observation.economicEvent",
  SpatialThing: "vf.geo.spatialThing",
  BatchLotRecord: "vf.resource.batchLotRecord",
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

  // Classification arrays: stay as plain strings
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
    if (r === "dtype:numericUnion") return { type: "string", description: "Numeric value as string (AT Protocol does not support floats)" };
    return { type: "string" };
  }

  // geosparql:Geometry → skip (testing, no AT equivalent)
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
    // maxLength for strings
    if (propDef.type === "string" && !propDef.format && !propDef.knownValues && !propDef.ref) {
      if (propName === "note") propDef.maxGraphemes = 10000;
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

// ─── write files ────────────────────────────────────────────────────────────

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

// ─── summary ────────────────────────────────────────────────────────────────

console.log("\n=== Summary ===");
const fileCount = Object.keys(allLexicons).length;
console.log(`Generated ${fileCount} lexicon files`);

// Count properties per record
for (const [nsid, lex] of Object.entries(allLexicons)) {
  if (!lex?.defs?.main?.record?.properties) continue;
  const propCount = Object.keys(lex.defs.main.record.properties).length;
  console.log(`  ${nsid}: ${propCount} properties`);
}
