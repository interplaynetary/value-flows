# GraphQL Gateway

`scripts/graphql-gateway.ts` is a standalone Apollo Server that auto-generates a typed GraphQL schema from the lexicons and proxies all queries to the HappyView XRPC API. It resolves AT-URI relationship fields via DataLoader so joins are deduped and parallelised within each request.

## Setup

```env
# .env
HAPPYVIEW_URL=https://your-happyview.up.railway.app
PORT=4000                # optional, default 4000
LEXICON_NS=vf            # optional, default "vf"
```

```bash
bun scripts/graphql-gateway.ts
# → http://localhost:4000/graphql
# → http://localhost:4000/health
```

Open [Apollo Sandbox](https://studio.apollographql.com/sandbox) and point it at `http://localhost:4000/graphql` — the schema is fully introspectable.

---

## Why GraphQL over raw XRPC

XRPC returns flat records with AT-URI strings for every relationship:

```json
{
  "uri": "at://did:plc:.../vf.observation.economicEvent/3xyz",
  "value": {
    "action": "at://did:plc:.../vf.knowledge.action/3abc",
    "resourceInventoriedAs": "at://did:plc:.../vf.observation.economicResource/3def"
  }
}
```

Rendering one economic event with its action and resource requires **3+ sequential HTTP calls**. GraphQL collapses this into one request:

```graphql
{
  economicEvents(limit: 10) {
    records {
      uri
      note
      action { actionId label }
      resourceInventoriedAs {
        name
        accountingQuantity {
          hasNumericalValue
          hasUnit { label symbol }
        }
      }
    }
  }
}
```

DataLoader deduplicates: if 10 events share the same `action` URI, it is fetched once, not ten times.

---

## Schema structure

The schema is generated automatically — no manual SDL. Each lexicon type maps to a GraphQL concept:

| Lexicon type | GraphQL output |
|---|---|
| `record` | Object type + `*Connection` wrapper |
| `query` | `Query` field with full filter args |
| `procedure` | *(mutations — not yet wired)* |
| `vf.defs#measure` | `Measure` embedded type |

### Record types

Every record type gets a `uri: String!` field plus all properties from the lexicon. Type mapping:

| Lexicon property | GraphQL type |
|---|---|
| `type: string` | `String` |
| `type: string, format: at-uri` | Resolved type (e.g. `Action`) or `String` |
| `type: string, format: did` | `String` |
| `type: string, format: datetime` | `String` |
| `type: integer` | `Int` |
| `type: boolean` | `Boolean` |
| `type: ref, ref: vf.defs#measure` | `Measure` |
| `type: array, items: at-uri` | `[ResolvedType]` |
| `type: array, items: string` | `[String]` |

### Connection types

Every record type has a matching connection wrapper:

```graphql
type EconomicEventConnection {
  records:  [EconomicEvent!]!
  cursor:   String
  hasMore:  Boolean!
}
```

### Query fields

Every list lexicon generates a Query field with all filter params auto-exposed:

```graphql
type Query {
  economicEvents(
    uri: String, action: String, inputOf: String, outputOf: String,
    provider: String, receiver: String, limit: Int, cursor: String
  ): EconomicEventConnection!

  actions(
    uri: String, actionId: String, inputOutput: String, limit: Int, cursor: String
  ): ActionConnection!

  # ... 23 more
}
```

---

## AT-URI field resolution

`format: at-uri` fields are resolved by name via a static config map (`FIELD_TO_NSID` in the gateway). Each field name maps to the XRPC endpoint that fetches records by URI:

| Field | Resolves via |
|---|---|
| `action` | `vf.knowledge.listActions` |
| `inputOf`, `outputOf` | `vf.planning.listProcesses` |
| `resourceInventoriedAs`, `toResourceInventoriedAs` | `vf.observation.listEconomicResources` |
| `resourceConformsTo`, `conformsTo` | `vf.knowledge.listResourceSpecifications` |
| `toLocation`, `primaryLocation`, `currentLocation` | `vf.knowledge.listSpatialThings` |
| `clauseOf`, `reciprocalClauseOf`, `realizationOf`, `reciprocalRealizationOf` | `vf.planning.listAgreements` |
| `plannedWithin`, `independentDemandOf` | `vf.planning.listPlans` |
| `stage` | `vf.knowledge.listProcessSpecifications` |
| `hasUnit` (in Measure) | `vf.knowledge.listUnits` |
| `settles` | `vf.planning.listClaims` |
| `fulfills` | `vf.planning.listCommitments` |
| `satisfies` | `vf.planning.listIntents` |

---

## DataLoader

One `DataLoader` is created per XRPC endpoint per GraphQL request. This means:

- **Deduplication** — the same AT-URI referenced by multiple records is fetched once.
- **Parallelism** — distinct URIs are fetched concurrently.
- **Request-scoped cache** — no stale data between separate GraphQL requests.

XRPC doesn't support batch-by-URI (each `?uri=` call returns one record), so DataLoader cannot reduce the total number of HTTP round-trips for N distinct URIs — but it eliminates duplicates and maximises concurrency.

---

## Pagination

Pagination works identically to XRPC — pass `limit` and `cursor`:

```graphql
# Page 1
{ economicEvents(limit: 20) { records { uri note } cursor hasMore } }

# Page 2 — pass cursor from previous response
{ economicEvents(limit: 20, cursor: "20") { records { uri note } cursor hasMore } }
```

`hasMore: false` when `cursor` is absent from the XRPC response.

---

## Fetching a single record

Pass `uri` to any query field — other filters are ignored:

```graphql
{
  economicEvents(uri: "at://did:plc:abc/vf.observation.economicEvent/3xyz") {
    records {
      uri
      action { label }
      resourceQuantity { hasNumericalValue hasUnit { symbol } }
    }
  }
}
```

---

## Example queries

### Economic event with full joins

```graphql
{
  economicEvents(limit: 5) {
    records {
      uri
      note
      hasPointInTime
      action {
        actionId
        label
        inputOutput
      }
      resourceInventoriedAs {
        name
        accountingQuantity {
          hasNumericalValue
          hasDenominator
          hasUnit { label symbol }
        }
      }
      fulfills {
        action { label }
      }
    }
    cursor
    hasMore
  }
}
```

### Filter by DID (user's own records)

```graphql
{
  commitments(provider: "did:plc:yourdid", limit: 20) {
    records {
      uri
      action { label }
      resourceQuantity { hasNumericalValue hasUnit { symbol } }
      finished
    }
  }
}
```

### Nested resource with unit

```graphql
{
  economicResources(limit: 10) {
    records {
      uri
      name
      accountingQuantity {
        hasNumericalValue
        hasUnit { label symbol }
      }
      conformsTo { name note }
      currentLocation { name }
    }
  }
}
```

### Proposal with intents

```graphql
{
  proposals(limit: 10) {
    records {
      uri
      note
      publishes {
        action { label }
        resourceInventoriedAs { name }
      }
    }
  }
}
```

---

## Extending the gateway

### Adding a new namespace

Set `LEXICON_NS` to any namespace that has lexicons in `lexicons/`:

```bash
LEXICON_NS=ngsi bun scripts/graphql-gateway.ts
```

### Adding AT-URI field resolution for a new type

Add an entry to `FIELD_TO_NSID` in `scripts/graphql-gateway.ts`:

```ts
const FIELD_TO_NSID: Record<string, string> = {
  // existing entries ...
  myNewField: "vf.knowledge.listMyNewType",
};
```

The resolver and DataLoader are generated automatically from this map.

### Adding mutations

Procedure lexicons (`type: procedure`) are loaded but not yet wired. To add mutations, iterate over `lex.type === "procedure"` lexicons in `buildTypeDefs` / `buildResolvers` and add a `Mutation` type that calls `xrpcPost` with the Bearer token from context.

---

For Svelte 5 integration patterns (consuming this gateway from a SvelteKit app), see [`docs/svelte.md`](svelte.md).
