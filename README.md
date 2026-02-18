# Economic Networks on AT protocols

`Xorganizing` > expressing and experimenting with organization

This repo is a platform for building, experimenting with, and deploying decentralized economic/organizational structures on the AT Protocol.

## Overview

This repository `xorganizing` is an experimental playground for organizational/economic architectures. It leverages the AT Protocol's decentralized, portable data model to express complex economic and social relationships.

The repository hosts several core vocabularies:

- **ValueFlows**: Economic network vocabulary for describing resource flows.
- **Playnet**: Extended economic network vocabulary for matching/allocation and constraints.
- **NGSI-LD**: Bridging IoT and context information models to AT Protocol.
- **...and more**: Designed for extensibility and rapid prototyping of new organizational "languages".

## Why AT Protocol?

AT Protocol offers several key advantages for decentralized economic networks:

- **Decentralized architecture** - No central points of control or failure
- **Horizontal scalability** - Designed to scale across many servers
- **User data portability** - Users own and can move their data
- **Censorship resistance** - Content can't be easily removed by intermediaries

## Leveraging Community Tools

The AT Protocol community is developing tools that make this integration particularly elegant:

- **HappyView** - Generate app views directly from schemas
- **Benefits**:
  - Close the loop between schema definition and full network deployment
  - Enable custom VF extensions simply by forking and extending schemas
  - Auto-generate XRPC endpoints from uploaded schemas

## Automated Collaborative Workflows

This repository is built for collaboration and automation. We've developed a suite of workflows in [`/scripts`](/scripts) to streamline the lifecycle of AT Protocol development:

- **Lexicon Auto-generation**: Tools like `owl-json-ld-lex-gen.ts` and `lex-query-lex-gen.ts` automatically generate AT Protocol lexicons from higher-level definitions (like OWL-JSON-LD or OWL-TTL).
- **Automated Deployment**: [`hv.ts`](/scripts/hv.ts) handles the process of pushing schemas to the network.
- **Intelligent Documentation**: Docs are treated as data. The pipeline automatically generates documentation in [`/docs`](/docs) from the resulting lexicons in [`/lexicons`](/lexicons).
- **Query & Index Generation**: Automated generation of xRPC queries and database indexes to power app views.

## Project Structure

- **[`/lexicons`](/lexicons)**: The source of truth for the network's data model (ValueFlows, Playnet, etc.).
- **[`/specs`](/specs)**: Original specifications and bridge definitions (e.g., NGSI-LD, ValueFlows).
- **[`/scripts`](/scripts)**: The automation engine for generation, deployment, and indexing.
- **[`/docs`](/docs)**: Auto-generated and curated documentation.
  - **[`docs/at-proto/specs`](/docs/at-proto/specs)**: Detailed AT Protocol technical specifications.
- **[`/tests`](/tests)**: Verification suites for lexicons and xRPC integrations.

## Infrastructure Strategy

### Phase 1: Piggyback on Bluesky

We can deploy immediately by leveraging existing infrastructure:

- Bluesky's PDS (Personal Data Server) instances
- Relay infrastructure
- Existing network effects

### Phase 2: Gradual Migration

As we scale, we can migrate to our own infrastructure while maintaining compatibility, thanks to AT Protocol's portable user data.

### Phase 3: Global Scale

Our Kubernetes cluster is ready to deploy app views globally with:

- Minimal latency through geographic distribution
- Self-healing infrastructure
- Automatic scaling

We can also define Kubernetes deployment with Guix for reproducible infrastructure as code. Giving anyone ability to deploy their own VF network at scale with ease.

## Getting Involved

If you are interested in protocol design, decentralized economics, or the future of digital organization, join us.

**Contact**: [ruzgarimski.bsky.social](https://bsky.app/profile/ruzgarimski.bsky.social)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/interplaynetary/value-flows.git

# Explore the automation scripts
ls scripts/

# View the auto-generated docs
https://interplaynetary.github.io/protocols
```

## HappyView CLI (`scripts/hv.ts`)

`hv.ts` is the admin CLI for managing lexicons and records on a HappyView instance. It handles OAuth login (DPoP), lexicon lifecycle, backfill jobs, and XRPC querying.

### Setup

Copy `.env.example` to `.env` (or create `.env`) and set your HappyView and AIP URLs:

```env
HAPPYVIEW_URL=https://your-happyview.up.railway.app
AIP_URL=https://your-aip.up.railway.app
MY_DID=did:plc:yourDID   # optional, used as login hint
```

Then log in — this opens a browser for OAuth and saves your token to `.env`:

```bash
bun scripts/hv.ts login
```

### Lexicon management

```bash
# List all lexicons currently registered on HappyView
bun scripts/hv.ts lexicons

# Upload all lexicons from lexicons/ (auto-infers target_collection for queries/procedures)
bun scripts/hv.ts lexicons upload

# Upload only a specific namespace
bun scripts/hv.ts lexicons upload --only vf

# Upload and trigger historical backfill for record lexicons
bun scripts/hv.ts lexicons upload --backfill

# Delete a single lexicon
bun scripts/hv.ts lexicons delete vf.observation.person

# Delete all registered lexicons
bun scripts/hv.ts lexicons delete-all

# Full redeploy: delete all, then upload fresh (most common workflow)
bun scripts/hv.ts lexicons sync
bun scripts/hv.ts lexicons sync --only vf
bun scripts/hv.ts lexicons sync --backfill
```

`upload` and `sync` automatically infer `target_collection` for query and procedure lexicons by stripping verb prefixes (`list`, `create`, `update`, …) and singularizing. Records are always uploaded before queries/procedures.

### Querying

```bash
# Hit a single XRPC query endpoint
bun scripts/hv.ts query vf.observation.listPersons
bun scripts/hv.ts query vf.observation.listPersons --did did:plc:abc123
bun scripts/hv.ts query vf.observation.listPersons --limit 5

# Hit all registered query endpoints (shows record counts)
bun scripts/hv.ts query-all
```

### Other commands

```bash
# Check auth status and list admins
bun scripts/hv.ts whoami

# Record counts by collection
bun scripts/hv.ts stats

# Admin management
bun scripts/hv.ts admins
bun scripts/hv.ts admins add did:plc:newadmin
bun scripts/hv.ts admins remove <uuid>

# Backfill jobs
bun scripts/hv.ts backfill
bun scripts/hv.ts backfill start
bun scripts/hv.ts backfill start vf.observation.person
```

## XRPC API

HappyView exposes all uploaded lexicons as live XRPC endpoints. There are two endpoint types, following AT Protocol conventions:

| Type | HTTP | Auth | Cacheable |
|------|------|------|-----------|
| Query | `GET /xrpc/{nsid}` | None | Yes |
| Procedure | `POST /xrpc/{nsid}` | Bearer token | No |

### Querying records

```bash
# List records (returns { records: [...], cursor?: string })
curl "https://your-happyview.up.railway.app/xrpc/vf.observation.listPersons"

# Paginate — pass limit and cursor; keep all other params fixed between pages
curl ".../xrpc/vf.observation.listPersons?limit=20"
curl ".../xrpc/vf.observation.listPersons?limit=20&cursor=<cursor>"

# Filter by DID (records authored by that user)
curl ".../xrpc/vf.observation.listPersons?did=did:plc:abc123"

# Fetch a single record by AT-URI (returns { record: {...} })
curl ".../xrpc/vf.observation.listPersons?uri=at://did:plc:abc123/vf.observation.person/3xyz"
```

**Query params** (all optional):

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 50 | Max records (1–100) |
| `cursor` | string | — | Opaque pagination token from previous response |
| `did` | string | — | Filter to records authored by this DID |
| `uri` | AT-URI | — | Fetch a single record; other filters ignored |

When `cursor` is absent from a response, the result set is exhausted. Never include `cursor` on the first request.

### Creating and updating records

Procedures proxy writes to the authenticated user's PDS, then index the result locally.

```bash
# Create a record (no uri in body → new record)
curl -X POST ".../xrpc/vf.knowledge.createUnit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "label": "kilogram", "symbol": "kg" }'

# Update a record (uri in body → updates existing)
curl -X POST ".../xrpc/vf.knowledge.createUnit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "uri": "at://did:plc:abc/vf.knowledge.unit/3xyz", "label": "kilogram", "symbol": "kg" }'
```

### Error responses

All errors follow the AT Protocol standard shape:

```json
{ "error": "InvalidRequest", "message": "limit must be between 1 and 100" }
```

Common status codes: `400` bad request · `401`/`403` auth required · `404` unknown endpoint · `500` server error.

For Svelte 5 integration patterns, see [`docs/svelte.md`](docs/svelte.md).

## GraphQL Gateway

`scripts/graphql-gateway.ts` is a standalone Apollo Server that auto-generates a typed GraphQL schema from the lexicons and proxies queries to HappyView XRPC. AT-URI relationship fields (e.g. `action`, `resourceInventoriedAs`) are resolved as typed GraphQL fields via DataLoader.

```bash
bun scripts/graphql-gateway.ts
# → http://localhost:4000/graphql  (introspectable via Apollo Sandbox)
# → http://localhost:4000/health
```

See [`docs/graphql.md`](docs/graphql.md) for the full reference.

## Current Tasks

- [x] Translate TTL -> JSON-LD schemas to AT Protocol lexicons
- [x] Deploy initial app view (HappyView)
- [ ] Create MCP Server
- [x] Implement GraphQL API layer ([`scripts/graphql-gateway.ts`](/scripts/graphql-gateway.ts))
- [ ] Deploy App-views to Kubernetes cluster
- [/] Document extension patterns for custom schemas
