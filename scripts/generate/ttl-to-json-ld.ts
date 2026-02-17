const ttl2jsonld = require("@frogcat/ttl2jsonld").parse;

const input = Bun.argv[2];
if (!input) {
  console.error("Usage: bun scripts/generate/ttl-to-json-ld.ts <input.ttl> [output.json]");
  process.exit(1);
}

const output = Bun.argv[3] ?? input.replace(/\.ttl$/i, ".json");

const ttl = await Bun.file(input).text();
const jsonld = ttl2jsonld(ttl);

await Bun.write(output, JSON.stringify(jsonld, null, 2) + "\n");
console.log(`✓ ${input} → ${output}`);

/*
bun scripts/generate/ttl-to-json-ld.ts specs/vf/vf.TTL
# → specs/vf/vf.json
bun scripts/generate/ttl-to-json-ld.ts specs/vf/vf.TTL output.json
# → output.json
*/