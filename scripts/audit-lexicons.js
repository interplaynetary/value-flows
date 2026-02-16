#!/usr/bin/env node
/**
 * Rigorous audit: compare vf.json ontology against generated AT Protocol lexicons.
 *
 * Extracts every class and property from vf.json, maps them to lexicon files,
 * and reports discrepancies: missing properties, extra properties, type mismatches.
 */

const fs = require('fs');
const path = require('path');

const VF_JSON = path.join(__dirname, '..', 'vf.json');
const LEXICON_DIR = path.join(__dirname, '..', 'lexicons', 'vf');

// ─── Class-to-Lexicon NSID mapping ───
const CLASS_TO_NSID = {
  'vf:Person': 'vf.agent.person',
  'vf:Organization': 'vf.agent.organization',
  'vf:EcologicalAgent': 'vf.agent.ecologicalAgent',
  'vf:Action': 'vf.knowledge.action',
  'vf:Unit': 'vf.knowledge.unit',
  'vf:ResourceSpecification': 'vf.knowledge.resourceSpecification',
  'vf:ProcessSpecification': 'vf.knowledge.processSpecification',
  'vf:EconomicEvent': 'vf.observation.economicEvent',
  'vf:EconomicResource': 'vf.observation.economicResource',
  'vf:Process': 'vf.planning.process',
  'vf:Plan': 'vf.planning.plan',
  'vf:Intent': 'vf.planning.intent',
  'vf:Commitment': 'vf.planning.commitment',
  'vf:Claim': 'vf.planning.claim',
  'vf:Agreement': 'vf.agreement.agreement',
  'vf:AgreementBundle': 'vf.agreement.agreementBundle',
  'vf:Proposal': 'vf.proposal.proposal',
  'vf:ProposalList': 'vf.proposal.proposalList',
  'vf:Recipe': 'vf.recipe.recipe',
  'vf:RecipeProcess': 'vf.recipe.recipeProcess',
  'vf:RecipeFlow': 'vf.recipe.recipeFlow',
  'vf:RecipeExchange': 'vf.recipe.recipeExchange',
  'vf:SpatialThing': 'vf.geo.spatialThing',
  'vf:BatchLotRecord': 'vf.resource.batchLotRecord',
};

// Classes we intentionally skip (abstract/structural, not records)
const SKIP_CLASSES = new Set([
  'vf:Agent',           // abstract superclass - split into Person/Organization/EcologicalAgent
  'vf:Measure',         // embedded object in vf.defs, not a record
  'vf:AgentRelationship', // mapped separately or deferred
  'vf:AgentRelationshipRole', // mapped separately or deferred
  // Enum classes - represented as knownValues on Action properties
  'vf:InputOutput',
  'vf:CreateResource',
  'vf:EventQuantity',
  'vf:AccountingEffect',
  'vf:OnhandEffect',
  'vf:LocationEffect',
  'vf:ContainedEffect',
  'vf:AccountableEffect',
  'vf:StageEffect',
  'vf:StateEffect',
  'vf:ProposalPurpose', // represented as knownValues on Proposal.purpose
]);

// Known property name mappings (vf property name -> lexicon property name)
const PROP_NAME_MAP = {
  'vf:hasNumericalValue': 'hasNumericalValue', // in Measure def
  'vf:hasUnit': 'hasUnit',                     // in Measure def
};

// ─── Parse vf.json ───
const vfData = JSON.parse(fs.readFileSync(VF_JSON, 'utf8'));
const graph = vfData['@graph'];

// Extract classes
const classes = {};
const properties = {};
const namedIndividuals = {};

for (const node of graph) {
  const typeRaw = node['@type'];
  const types = Array.isArray(typeRaw) ? typeRaw : [typeRaw];
  const id = node['@id'];

  if (types.includes('owl:Class') && id?.startsWith('vf:')) {
    classes[id] = {
      label: node['rdfs:label']?.['@value'] || id,
      comment: node['rdfs:comment']?.['@value'] || '',
      status: node['vs:term_status'] || 'unknown',
    };
  }

  if ((types.includes('owl:ObjectProperty') || types.includes('owl:DatatypeProperty') || types.includes('owl:DataTypeProperty') || types.includes('owl:FunctionalProperty')) && id?.startsWith('vf:')) {
    const domainRaw = node['rdfs:domain'];
    const rangeRaw = node['rdfs:range'];
    const comment = node['rdfs:comment']?.['@value'] || '';
    const status = node['vs:term_status'] || 'unknown';

    // Extract domain classes
    const domainClasses = extractClasses(domainRaw);
    // Extract range
    const rangeClasses = extractClasses(rangeRaw);
    const rangeType = extractRangeType(rangeRaw);

    properties[id] = {
      type: typeRaw,
      domain: domainClasses,
      range: rangeClasses,
      rangeType,
      comment,
      status,
    };
  }

  if (types.includes('owl:NamedIndividual') && id?.startsWith('vf:')) {
    namedIndividuals[id] = node;
  }
}

function extractClasses(node) {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (node['@id']) return [node['@id']];
  if (node['owl:unionOf']) {
    let union = node['owl:unionOf'];
    // JSON-LD @list wrapper
    if (union['@list']) union = union['@list'];
    if (Array.isArray(union)) {
      return union.flatMap(u => extractClasses(u));
    }
  }
  return [];
}

function extractRangeType(node) {
  if (!node) return 'unknown';
  if (typeof node === 'string') return node;
  if (node['@id']) return node['@id'];
  if (node['owl:unionOf']) {
    let union = node['owl:unionOf'];
    if (union['@list']) union = union['@list'];
    if (Array.isArray(union)) {
      return union.map(u => u['@id'] || JSON.stringify(u)).join(' | ');
    }
  }
  return JSON.stringify(node);
}

// ─── Build expected properties per class ───
// Map: className -> { propName: { rangeType, comment, owl type } }
const expectedByClass = {};

// Initialize with empty maps
for (const cls of Object.keys(CLASS_TO_NSID)) {
  expectedByClass[cls] = {};
}

// Agent is abstract; its properties should appear on Person, Organization, EcologicalAgent
const AGENT_SUBCLASSES = ['vf:Person', 'vf:Organization', 'vf:EcologicalAgent'];

for (const [propId, prop] of Object.entries(properties)) {
  const propName = propId.replace('vf:', '');

  for (const domainClass of prop.domain) {
    // If domain is vf:Agent, distribute to subclasses
    if (domainClass === 'vf:Agent') {
      for (const sub of AGENT_SUBCLASSES) {
        if (expectedByClass[sub]) {
          expectedByClass[sub][propName] = prop;
        }
      }
    } else if (expectedByClass[domainClass]) {
      expectedByClass[domainClass][propName] = prop;
    }
  }
}

// ─── Load all lexicon files ───
const lexicons = {};

function loadLexicons(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      loadLexicons(fullPath);
    } else if (entry.name.endsWith('.json')) {
      const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      if (data.id) {
        lexicons[data.id] = data;
      }
    }
  }
}

loadLexicons(LEXICON_DIR);

// ─── Expected range type to lexicon type mapping ───
function expectedLexiconType(rangeType, owlType) {
  // Datatype properties
  if (rangeType === 'xsd:string') return { type: 'string' };
  if (rangeType === 'xsd:boolean') return { type: 'boolean' };
  if (rangeType === 'xsd:dateTimeStamp') return { type: 'string', format: 'datetime' };
  if (rangeType === 'xsd:anyURI') return { type: 'string', format: 'uri' };
  if (rangeType === 'xsd:decimal' || rangeType === 'xsd:float' || rangeType === 'dtype:numericUnion') {
    return { type: 'ref', ref: 'vf.defs#measure' }; // decimals use measure
  }

  // Object properties pointing to agents
  if (rangeType === 'vf:Agent') return { type: 'string', format: 'did' };

  // Object properties pointing to Measure
  if (rangeType === 'vf:Measure' || rangeType === 'om:Measure') return { type: 'ref', ref: 'vf.defs#measure' };

  // Object properties pointing to Action - we use knownValues enum
  if (rangeType === 'vf:Action') return { type: 'string', note: 'knownValues enum or at-uri' };

  // Object properties pointing to SpatialThing
  if (rangeType === 'vf:SpatialThing' || rangeType === 'geo:SpatialThing') return { type: 'string', format: 'at-uri' };

  // Enum classes used as knownValues (not separate records)
  const ENUM_CLASSES = new Set([
    'vf:InputOutput', 'vf:CreateResource', 'vf:EventQuantity',
    'vf:AccountingEffect', 'vf:OnhandEffect', 'vf:LocationEffect',
    'vf:ContainedEffect', 'vf:AccountableEffect', 'vf:StageEffect',
    'vf:StateEffect', 'vf:ProposalPurpose',
  ]);
  if (ENUM_CLASSES.has(rangeType)) return { type: 'string', note: 'enum as knownValues' };

  // Object properties pointing to other VF records
  if (rangeType?.startsWith('vf:')) return { type: 'string', format: 'at-uri' };

  // Geometry
  if (rangeType === 'geosparql:Geometry') return { type: 'string', note: 'geometry - may be omitted' };

  // time:Duration
  if (rangeType === 'time:Duration') return { type: 'ref', ref: 'vf.defs#measure' };

  // ProposalPurpose enum
  if (rangeType === 'vf:ProposalPurpose') return { type: 'string', note: 'knownValues enum' };

  return { type: 'unknown', raw: rangeType };
}

// ─── Compare ───
const report = {
  missingFromLexicon: [],   // in vf.json but not in lexicon
  extraInLexicon: [],       // in lexicon but not in vf.json
  typeMismatches: [],       // property exists but type differs
  classesNotMapped: [],     // vf.json classes with no lexicon
  summary: { total: 0, missing: 0, extra: 0, mismatched: 0 },
};

// Check for unmapped classes
for (const cls of Object.keys(classes)) {
  if (!CLASS_TO_NSID[cls] && !SKIP_CLASSES.has(cls)) {
    report.classesNotMapped.push({
      class: cls,
      label: classes[cls].label,
      status: classes[cls].status,
    });
  }
}

// For each mapped class, compare properties
for (const [vfClass, nsid] of Object.entries(CLASS_TO_NSID)) {
  const expected = expectedByClass[vfClass] || {};
  const lexicon = lexicons[nsid];

  if (!lexicon) {
    report.classesNotMapped.push({ class: vfClass, nsid, error: 'LEXICON FILE MISSING' });
    continue;
  }

  const record = lexicon.defs?.main?.record;
  if (!record) continue;

  const lexiconProps = record.properties || {};
  const expectedPropNames = Object.keys(expected);
  const lexiconPropNames = Object.keys(lexiconProps);

  // Properties in vf.json but missing from lexicon
  for (const propName of expectedPropNames) {
    if (!lexiconProps[propName]) {
      const prop = expected[propName];
      report.missingFromLexicon.push({
        class: vfClass,
        nsid,
        property: propName,
        rangeType: prop.rangeType,
        owlType: prop.type,
        comment: prop.comment,
        status: prop.status,
      });
      report.summary.missing++;
    }
    report.summary.total++;
  }

  // Properties in lexicon but not in vf.json
  for (const propName of lexiconPropNames) {
    // Some properties are structural/added by us (like 'note' on types that don't have it in OWL)
    if (!expected[propName]) {
      const lexProp = lexiconProps[propName];
      report.extraInLexicon.push({
        class: vfClass,
        nsid,
        property: propName,
        lexiconType: lexProp.type,
        lexiconFormat: lexProp.format,
        description: lexProp.description,
      });
      report.summary.extra++;
    }
  }

  // Type comparison for properties that exist in both
  for (const propName of expectedPropNames) {
    if (!lexiconProps[propName]) continue;

    const prop = expected[propName];
    const lexProp = lexiconProps[propName];
    const expectedType = expectedLexiconType(prop.rangeType, prop.type);

    const issues = [];

    // Check basic type
    if (expectedType.type !== 'unknown') {
      // For arrays, check the items
      if (lexProp.type === 'array') {
        // Array is acceptable for certain multi-valued properties
        // Check if the property should be multi-valued
      } else if (expectedType.type === 'ref' && lexProp.type === 'ref') {
        if (expectedType.ref && lexProp.ref !== expectedType.ref) {
          issues.push(`ref mismatch: expected ${expectedType.ref}, got ${lexProp.ref}`);
        }
      } else if (expectedType.type === 'string' && lexProp.type === 'string') {
        if (expectedType.format && lexProp.format !== expectedType.format) {
          // did vs at-uri etc
          issues.push(`format mismatch: expected ${expectedType.format}, got ${lexProp.format || 'none'}`);
        }
      } else if (expectedType.type !== lexProp.type && lexProp.type !== 'array') {
        // Type mismatch (but arrays can be valid for multi-value props)
        if (expectedType.note) {
          // Known special case
        } else {
          issues.push(`type mismatch: expected ${expectedType.type}, got ${lexProp.type}`);
        }
      }
    }

    if (issues.length > 0) {
      report.typeMismatches.push({
        class: vfClass,
        nsid,
        property: propName,
        vfRange: prop.rangeType,
        lexiconType: lexProp.type,
        lexiconFormat: lexProp.format,
        lexiconRef: lexProp.ref,
        issues,
      });
      report.summary.mismatched++;
    }
  }
}

// ─── Also check Action named individuals ───
const actionLexicon = lexicons['vf.knowledge.action'];
const actionProps = actionLexicon?.defs?.main?.record?.properties || {};
const actionKnownValues = actionProps.label?.knownValues || [];

const vfActions = Object.keys(namedIndividuals).filter(id => {
  const node = namedIndividuals[id];
  // Check if it has Action-like properties (inputOutput, pairsWith, etc.)
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  const hasActionProps = node['vf:inputOutput'] || node['vf:pairsWith'] || node['vf:eventQuantity'] || node['vf:accountingEffect'];
  return types.includes('owl:NamedIndividual') && hasActionProps;
});

// Extract action properties from vf.json named individuals
const actionNamedProps = new Set();
for (const actionId of vfActions) {
  const node = namedIndividuals[actionId];
  for (const key of Object.keys(node)) {
    if (key.startsWith('vf:') || key === 'rdfs:label' || key === 'rdfs:comment') {
      const propName = key.replace('vf:', '').replace('rdfs:', '');
      actionNamedProps.add(propName);
    }
  }
}

// ─── Check vf.defs#measure ───
const defsLexicon = lexicons['vf.defs'];
const measureDef = defsLexicon?.defs?.measure;
const measureExpectedProps = ['hasNumericalValue', 'hasDenominator', 'hasUnit'];

// ─── Print Report ───
console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║         VF ONTOLOGY → AT PROTOCOL LEXICON AUDIT REPORT         ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

// Section 1: Unmapped classes
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  1. CLASSES IN VF.JSON NOT MAPPED TO LEXICONS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (report.classesNotMapped.length === 0) {
  console.log('  ✓ All classes mapped (or intentionally skipped)');
} else {
  for (const item of report.classesNotMapped) {
    console.log(`  ✗ ${item.class} (${item.label || ''}) [${item.status || ''}] ${item.error || ''}`);
  }
}
console.log(`  Intentionally skipped: ${[...SKIP_CLASSES].join(', ')}`);
console.log();

// Section 2: Missing properties
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  2. PROPERTIES IN VF.JSON MISSING FROM LEXICONS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (report.missingFromLexicon.length === 0) {
  console.log('  ✓ No missing properties');
} else {
  // Group by class
  const grouped = {};
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

// Section 3: Extra properties
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  3. PROPERTIES IN LEXICONS NOT IN VF.JSON (ADDITIONS)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (report.extraInLexicon.length === 0) {
  console.log('  ✓ No extra properties');
} else {
  const grouped = {};
  for (const item of report.extraInLexicon) {
    if (!grouped[item.nsid]) grouped[item.nsid] = [];
    grouped[item.nsid].push(item);
  }
  for (const [nsid, items] of Object.entries(grouped)) {
    console.log(`\n  ${nsid}:`);
    for (const item of items) {
      console.log(`    + ${item.property} (${item.lexiconType}${item.lexiconFormat ? `, format: ${item.lexiconFormat}` : ''})`);
      console.log(`      "${item.description}"`);
    }
  }
}
console.log();

// Section 4: Type mismatches
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  4. TYPE/FORMAT MISMATCHES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (report.typeMismatches.length === 0) {
  console.log('  ✓ No type mismatches');
} else {
  for (const item of report.typeMismatches) {
    console.log(`  ✗ ${item.nsid}.${item.property}`);
    console.log(`    VF range: ${item.vfRange}`);
    console.log(`    Lexicon: type=${item.lexiconType}, format=${item.lexiconFormat || 'none'}, ref=${item.lexiconRef || 'none'}`);
    for (const issue of item.issues) {
      console.log(`    → ${issue}`);
    }
  }
}
console.log();

// Section 5: Action named individuals audit
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  5. ACTION NAMED INDIVIDUALS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// List all action individuals from vf.json
const actionLabels = [];
for (const actionId of vfActions) {
  const node = namedIndividuals[actionId];
  const label = node['rdfs:label']?.['@value'] || actionId;
  actionLabels.push(label);
}
console.log(`  VF actions (${vfActions.length}): ${actionLabels.join(', ')}`);
console.log(`  Lexicon label knownValues (${actionKnownValues.length}): ${actionKnownValues.join(', ')}`);

// Check action properties defined in lexicon vs what's on named individuals
console.log(`\n  Action properties in vf.json named individuals: ${[...actionNamedProps].join(', ')}`);
console.log(`  Action properties in lexicon: ${Object.keys(actionProps).join(', ')}`);

const missingActionProps = [...actionNamedProps].filter(p => !actionProps[p] && p !== 'label' && p !== 'comment' && p !== '@type' && p !== '@id');
const extraActionProps = Object.keys(actionProps).filter(p => !actionNamedProps.has(p) && p !== 'description' && p !== 'note');
if (missingActionProps.length > 0) {
  console.log(`  ✗ Missing from action lexicon: ${missingActionProps.join(', ')}`);
}
if (extraActionProps.length > 0) {
  console.log(`  + Extra in action lexicon: ${extraActionProps.join(', ')}`);
}
console.log();

// Section 6: Measure definition audit
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  6. VF.DEFS MEASURE DEFINITION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (measureDef) {
  const measureProps = Object.keys(measureDef.properties || {});
  console.log(`  Defined properties: ${measureProps.join(', ')}`);
  console.log(`  Expected: ${measureExpectedProps.join(', ')}`);
  const missingMeasure = measureExpectedProps.filter(p => !measureDef.properties[p]);
  if (missingMeasure.length > 0) {
    console.log(`  ✗ Missing: ${missingMeasure.join(', ')}`);
  } else {
    console.log('  ✓ All measure properties present');
  }
} else {
  console.log('  ✗ vf.defs#measure not found!');
}
console.log();

// Section 7: Cross-reference integrity
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  7. CROSS-REFERENCE INTEGRITY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const allNsids = new Set(Object.keys(lexicons));
let brokenRefs = 0;

for (const [nsid, lex] of Object.entries(lexicons)) {
  const props = lex.defs?.main?.record?.properties || {};
  for (const [propName, propDef] of Object.entries(props)) {
    // Check ref types
    if (propDef.ref) {
      const [refNsid] = propDef.ref.split('#');
      if (!allNsids.has(refNsid)) {
        console.log(`  ✗ ${nsid}.${propName}: ref "${propDef.ref}" → ${refNsid} NOT FOUND`);
        brokenRefs++;
      }
    }
    // Check array item refs
    if (propDef.items?.ref) {
      const [refNsid] = propDef.items.ref.split('#');
      if (!allNsids.has(refNsid)) {
        console.log(`  ✗ ${nsid}.${propName}[]: ref "${propDef.items.ref}" → ${refNsid} NOT FOUND`);
        brokenRefs++;
      }
    }
  }
  // Check non-main defs too
  for (const [defName, def] of Object.entries(lex.defs || {})) {
    if (defName === 'main') continue;
    const defProps = def.properties || {};
    for (const [propName, propDef] of Object.entries(defProps)) {
      if (propDef.ref) {
        const [refNsid] = propDef.ref.split('#');
        if (!allNsids.has(refNsid)) {
          console.log(`  ✗ ${nsid}#${defName}.${propName}: ref "${propDef.ref}" → ${refNsid} NOT FOUND`);
          brokenRefs++;
        }
      }
    }
  }
}
if (brokenRefs === 0) {
  console.log('  ✓ All refs resolve to existing lexicons');
}
console.log();

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  Total VF properties checked: ${report.summary.total}`);
console.log(`  Missing from lexicons:       ${report.summary.missing}`);
console.log(`  Extra in lexicons:           ${report.summary.extra}`);
console.log(`  Type/format mismatches:      ${report.summary.mismatched}`);
console.log(`  Unmapped classes:            ${report.classesNotMapped.length}`);
console.log(`  Broken refs:                 ${brokenRefs}`);
console.log();
