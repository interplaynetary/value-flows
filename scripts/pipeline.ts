#!/usr/bin/env bun
/**
 * Runs the full lexicon pipeline. See pipeline.md for details.
 *
 * Usage: bun run pipeline
 */

import { join } from "path";

const ROOT = join(import.meta.dir, "..");

async function run(label: string, cmd: string, cwd = ROOT) {
  console.log(`\n▶ ${label}`);
  console.log(`  ${cmd}\n`);
  const proc = Bun.spawn(["bash", "-c", cmd], { cwd, stdout: "inherit", stderr: "inherit" });
  const code = await proc.exited;
  if (code !== 0) {
    console.error(`\n✗ Step failed (exit ${code}): ${label}`);
    process.exit(code);
  }
}

await run(
  "Step 1 — Record lexicons (OWL → JSON)",
  "bun scripts/owl-json-ld-lex-gen.ts specs/vf/vf.json --mapping specs/vf/class-to-nsid-flat.json --output lexicons"
);

await run(
  "Step 2 — Query + procedure lexicons",
  "bun scripts/lex-query-lex-gen.ts"
);

await run(
  "Step 3 — TypeScript types (root)",
  "bun x @atproto/lex build --lexicons ./lexicons --out ./.src/lexicons --clear"
);

await run(
  "Step 4 — TypeScript types (template-app)",
  "bun x @atproto/lex build --lexicons ./lexicons --out ./template-app/src/lib/lexicons --clear"
);

console.log("\n✓ Pipeline complete\n");
