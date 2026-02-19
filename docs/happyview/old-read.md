## Quick Start

```bash
# Clone the repository
git clone https://github.com/interplaynetary/value-flows.git

# Explore the automation scripts
ls scripts/

# View the auto-generated docs
https://interplaynetary.github.io/protocols
```

## HappyView CLI (`scripts/happyview.ts`)

`happyview.ts` is the admin CLI for managing lexicons and records on a HappyView instance. It handles OAuth login (DPoP), lexicon lifecycle, backfill jobs, and XRPC querying.

### Setup

Copy `.env.example` to `.env` (or create `.env`) and set your HappyView and AIP URLs:

```env
HAPPYVIEW_URL=https://your-happyview.up.railway.app
AIP_URL=https://your-aip.up.railway.app
MY_DID=did:plc:yourDID   # optional, used as login hint
```

Then log in — this opens a browser for OAuth and saves your token to `.env`:

```bash
bun scripts/happyview.ts login
```

### Lexicon management

```bash
# List all lexicons currently registered on HappyView
bun scripts/happyview.ts lexicons

# Upload all lexicons from lexicons/ (auto-infers target_collection for queries/procedures)
bun scripts/happyview.ts lexicons upload

# Upload only a specific namespace
bun scripts/happyview.ts lexicons upload --only vf

# Upload and trigger historical backfill for record lexicons
bun scripts/happyview.ts lexicons upload --backfill

# Delete a single lexicon
bun scripts/happyview.ts lexicons delete vf.observation.person

# Delete all registered lexicons
bun scripts/happyview.ts lexicons delete-all

# Full redeploy: delete all, then upload fresh (most common workflow)
bun scripts/happyview.ts lexicons sync
bun scripts/happyview.ts lexicons sync --only vf
bun scripts/happyview.ts lexicons sync --backfill
```

`upload` and `sync` automatically infer `target_collection` for query and procedure lexicons by stripping verb prefixes (`list`, `create`, `update`, …) and singularizing. Records are always uploaded before queries/procedures.

### Querying

```bash
# Hit a single XRPC query endpoint
bun scripts/happyview.ts query vf.observation.listPersons
bun scripts/happyview.ts query vf.observation.listPersons --did did:plc:abc123
bun scripts/happyview.ts query vf.observation.listPersons --limit 5

# Hit all registered query endpoints (shows record counts)
bun scripts/happyview.ts query-all
```

### Other commands

```bash
# Check auth status and list admins
bun scripts/happyview.ts whoami

# Record counts by collection
bun scripts/happyview.ts stats

# Admin management
bun scripts/happyview.ts admins
bun scripts/happyview.ts admins add did:plc:newadmin
bun scripts/happyview.ts admins remove <uuid>

# Backfill jobs
bun scripts/happyview.ts backfill
bun scripts/happyview.ts backfill start
bun scripts/happyview.ts backfill start vf.observation.person
```

## XRPC API

HappyView exposes all uploaded lexicons as live XRPC endpoints. There are two endpoint types, following AT Protocol conventions:

| Type      | HTTP                | Auth         | Cacheable |
| --------- | ------------------- | ------------ | --------- |
| Query     | `GET /xrpc/{nsid}`  | None         | Yes       |
| Procedure | `POST /xrpc/{nsid}` | Bearer token | No        |

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

| Param    | Type    | Default | Description                                    |
| -------- | ------- | ------- | ---------------------------------------------- |
| `limit`  | integer | 50      | Max records (1–100)                            |
| `cursor` | string  | —       | Opaque pagination token from previous response |
| `did`    | string  | —       | Filter to records authored by this DID         |
| `uri`    | AT-URI  | —       | Fetch a single record; other filters ignored   |

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
