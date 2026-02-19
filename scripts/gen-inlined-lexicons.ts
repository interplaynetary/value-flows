/**
 * gen-inlined-lexicons.ts
 *
 * Reads lexicons-flat/openassociation/*.json (25 files) and produces
 * lexicons-inlined/openassociation/*.json (24 files) where every schema
 * is self-contained — cross-lexicon refs to defs#measure are replaced
 * with a local #measure def.
 *
 * Also writes lexicons-inlined/dependency-map.json with the full
 * dependency analysis.
 *
 * Usage: bun scripts/gen-inlined-lexicons.ts
 */

import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";

const INPUT_DIR = path.resolve(import.meta.dir, "../lexicons/openassociation");
const OUTPUT_DIR = path.resolve(import.meta.dir, "../lexicons-inlined/openassociation");
const DEFS_ID = "org.openassociation.defs";
const MEASURE_REF = `${DEFS_ID}#measure`;
const LOCAL_MEASURE_REF = "#measure";

// Essentiality tiers from the dependency map
const TIERS: Record<string, string[]> = {
  core: ["action", "economicEvent", "process", "economicResource", "unit", "defs"],
  planning: ["commitment", "intent", "plan", "claim"],
  knowledge: ["resourceSpecification", "processSpecification", "recipeFlow", "recipeProcess", "recipe", "recipeExchange"],
  peripheral: ["proposal", "proposalList", "agreement", "agreementBundle", "spatialThing", "batchLotRecord", "person", "organization", "ecologicalAgent"],
};

/**
 * Recursively walk a JSON value and replace all occurrences of the measure ref.
 * Returns [modified value, count of replacements made].
 */
function inlineRefs(value: unknown): [unknown, number] {
  if (value === null || typeof value !== "object") return [value, 0];

  if (Array.isArray(value)) {
    let total = 0;
    const result = value.map((item) => {
      const [v, n] = inlineRefs(item);
      total += n;
      return v;
    });
    return [result, total];
  }

  const obj = value as Record<string, unknown>;
  let total = 0;
  const result: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (k === "ref" && v === MEASURE_REF) {
      result[k] = LOCAL_MEASURE_REF;
      total += 1;
    } else {
      const [newV, n] = inlineRefs(v);
      result[k] = newV;
      total += n;
    }
  }

  return [result, total];
}

async function main() {
  // Read all JSON files from input dir
  const entries = await readdir(INPUT_DIR);
  const jsonFiles = entries.filter((f) => f.endsWith(".json")).sort();

  // Load defs.json to extract the measure definition
  const defsPath = path.join(INPUT_DIR, "defs.json");
  const defsRaw = await Bun.file(defsPath).json();
  const measureDef = defsRaw.defs?.measure;
  if (!measureDef) {
    throw new Error("Could not find defs.measure in defs.json");
  }

  // Ensure output directory exists
  await mkdir(OUTPUT_DIR, { recursive: true });

  const schemaRefs: Record<string, string[]> = {};
  const selfContained: string[] = [];
  const modified: string[] = [];

  for (const file of jsonFiles) {
    const name = file.replace(".json", "");

    // Skip defs.json — it won't be emitted
    if (name === "defs") {
      console.log(`  [skip]    defs.json (measure source, not emitted)`);
      continue;
    }

    const inputPath = path.join(INPUT_DIR, file);
    const lexicon = await Bun.file(inputPath).json();

    const [inlined, refCount] = inlineRefs(lexicon);
    const result = inlined as Record<string, unknown>;

    if (refCount > 0) {
      // Add the measure def to the lexicon's defs section
      const defs = result.defs as Record<string, unknown>;
      defs.measure = measureDef;

      schemaRefs[name] = ["defs#measure"];
      modified.push(name);
      console.log(`  [inlined] ${file} — ${refCount} ref(s) replaced, measure def added`);
    } else {
      selfContained.push(name);
      console.log(`  [clean]   ${file} — no refs`);
    }

    const outputPath = path.join(OUTPUT_DIR, file);
    await Bun.write(outputPath, JSON.stringify(result, null, 2) + "\n");
  }

  // Write dependency-map.json one level up from the openassociation subdir
  const depMapPath = path.resolve(OUTPUT_DIR, "../dependency-map.json");
  const dependencyMap = {
    schemaRefs,
    selfContained,
    tiers: TIERS,
  };
  await Bun.write(depMapPath, JSON.stringify(dependencyMap, null, 2) + "\n");

  console.log("\nSummary:");
  console.log(`  Input files:  ${jsonFiles.length}`);
  console.log(`  Output files: ${jsonFiles.length - 1} (defs.json omitted)`);
  console.log(`  Inlined:      ${modified.join(", ")}`);
  console.log(`  Self-contained: ${selfContained.join(", ")}`);
  console.log(`\nDependency map written to: ${depMapPath}`);
  console.log(`Lexicons written to:        ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
