# Lexicon Pipeline

Generates AT Protocol lexicons from the ValueFlows OWL ontology and compiles them to TypeScript.

```
bun run pipeline
```

## Steps

### 1 — Record lexicons (OWL → JSON)

```
bun scripts/owl-json-ld-lex-gen.ts specs/vf/vf.json \
  --mapping specs/vf/class-to-nsid-flat.json \
  --output lexicons
```

Reads `specs/vf/vf.json` and `specs/vf/class-to-nsid-flat.json`.
Writes **25 record lexicons** to `lexicons/openassociation/`, including `action.json` and `unit.json`.

### 2 — Query + procedure lexicons (records → XRPC)

```
bun scripts/lex-query-lex-gen.ts
```

Reads `lexicons/openassociation/*.json` (record types only).
Derives filter params from `at-uri` / `did` / `knownValues` / `boolean` properties.
Writes **25 query** (`list*.json`) + **25 procedure** (`create*.json`) lexicons back to `lexicons/openassociation/`.

### 3 — TypeScript types (root)

```
bun x @atproto/lex build --lexicons ./lexicons --out ./.src/lexicons --clear
```

Compiles all 75 lexicons to TypeScript in `.src/lexicons/`.
Used by root scripts and tools.

### 4 — TypeScript types (template-app)

```
bun x @atproto/lex build --lexicons ./lexicons --out ./template-app/src/lib/lexicons --clear
```

Same compilation, output into `template-app/src/lib/lexicons/`.
Makes the app self-contained — `$lex` alias resolves locally, no `../` references.

## Outputs

| Path | Contents |
|---|---|
| `lexicons/openassociation/` | Source JSON lexicons (committed) |
| `.src/lexicons/` | Root TypeScript types (generated, gitignored) |
| `template-app/src/lib/lexicons/` | App TypeScript types (generated, gitignored) |
