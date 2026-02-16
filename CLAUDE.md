# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project bridges the [ValueFlows](http://valueflo.ws/) economic network vocabulary to the AT Protocol ecosystem. It contains:

1. **`vf-graphql/`** - A Bun monorepo with the reference GraphQL specification of the ValueFlows grammar (forked from the upstream VF project), plus servers and tooling
2. **`docs/`** - Architecture docs, AT Protocol integration analysis, Quickslice/Lexicon specs
3. **`lexicons/`** - AT Protocol lexicon definitions (in progress)
4. **`vf.TTL`** / **`vf.json`** - ValueFlows ontology in Turtle and JSON-LD formats

The long-term goal is to deploy VF data on AT Protocol using Quickslice (auto-generated GraphQL AppViews from Lexicon schemas), with Kubernetes-based federated indexing.

## Commands

All commands run from `vf-graphql/` using **Bun** as the package manager and runtime.

```bash
# Install dependencies
cd vf-graphql && bun install

# Build the schema library
bun run build            # builds lib/ (codegen + schema compilation)

# Run tests
bun run test             # runs tests from vf-graphql/tests/
cd tests && bun test     # run directly

# Development (watch mode - rebuilds schemas + runs mock server)
bun start                # runs dev:schema and dev:demoUI in parallel

# Individual dev servers
bun run dev:schema       # watch-build schemas in lib/
bun run dev:demoUI       # mock GraphQL server at localhost:3000/graphql
bun run dev:production   # production server with DB (needs PostgreSQL + .env)

# MCP server
cd mcp-server && bun run dev
```

## Architecture

### vf-graphql Monorepo Structure

The monorepo has these workspaces:

- **`lib/`** - Core package (`@valueflows/vf-graphql`). Contains GraphQL SDL schema files in `lib/schemas/` and exports `buildSchema()`, `printSchema()`, and `validate()`. Schema modules are composable - `buildSchema()` accepts an array of module IDs to create partial specs.
- **`mock-server/`** - Hono + Apollo Server serving a mock GraphQL API with GraphiQL UI and GraphQL Voyager
- **`production-server/`** - Hono + Apollo + Drizzle ORM + PostgreSQL + BetterAuth. Has its own Drizzle migrations in `drizzle/`
- **`mcp-server/`** - MCP server exposing VF schema for AI tool integration
- **`tests/`** - Schema compilation tests
- **`mock-client/`** - Client package for consuming VF schemas

### Bridging Schemas (Important)

Schema files in `lib/schemas/bridging/` use a naming convention where dot-separated filename components correspond to module IDs. If all components are present in the requested modules, the bridging schema is automatically injected. For example, `observation.agreement.gql` adds fields (like `EconomicEvent.realizationOf`) only when both `observation` and `agreement` modules are included. Always check bridging files before assuming a field is missing.

### AT Protocol Integration

- VF types map to AT Protocol Lexicons with `vf.*` NSIDs (e.g., `vf.observation.economicEvent`, `vf.agent.person`)
- Agents are referenced by DID, records by AT URI
- Quickslice auto-generates GraphQL from uploaded Lexicons, handles Jetstream ingestion, OAuth, and joins
- The conversion pipeline is: TTL -> JSON-LD -> Zod Schema -> Lexicon (see `workflow.md`)

### Key Lexicon Mappings

| Lexicon ID | VF Concept |
|---|---|
| `vf.agent.person` / `vf.agent.organization` | Economic actors |
| `vf.observation.economicEvent` | Observed economic flows |
| `vf.observation.economicResource` | Tracked assets |
| `vf.plan.process` | Transformation activities |
| `vf.plan.commitment` | Promises/planned flows |

## Tech Stack

- **Runtime/Package Manager**: Bun
- **GraphQL**: Apollo Server, @graphql-tools
- **Web Framework**: Hono
- **Database** (production): PostgreSQL with Drizzle ORM
- **Auth** (production): BetterAuth
- **AT Protocol indexer**: Quickslice (external, Gleam/Erlang + SQLite/Postgres)
