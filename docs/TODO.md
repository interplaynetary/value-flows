Write tests for various parts of interacting with our QuickSlice Instance

Deploy OAuth on free.playnet.lol

---

AT Proto Lex:
@atproto/lex automates this by:

Fetching lexicons from the network and generating TypeScript types
Providing runtime validation to ensure data matches schemas
Offering a type-safe client that knows which parameters each endpoint expects
Support modern patterns like tree-shaking and composition

---

At the moment, it's not really very feasible to create a new record containing a union type in GraphQL. This is because the mandatory $type field for type differentiation in unions collides with the GraphQL syntax for variables and so cannot be represented. This is a pretty notable issue, given that even core Bluesky types like app.bsky.feed.post use union types liberally. Is there a good workaround for this in GraphQL? It doesn't seem to like escaping field names in quotes, but I've been having some other issues getting GraphiQL to play nice so I'm not sure how illegal it is.

---

What's likely causing the
3 minutes: QuickSlice is
probably doing something
like inferring union
types for each at-uri
field by scanning all
schemas — O(fields ×
schemas) at minimum, but
if it's building full
traversal paths, it could
be exponential in the
cycle count
(economicEvent ↔
commitment ↔ intent form
a triangle of mutual
references).

Practical question: do
you actually need
QuickSlice to generate
resolvers for all 20
schemas, or are you
primarily querying a
subset? If you only need
economicEvent,
economicResource,
process, commitment, and
agent — the core
operational tier —
uploading just those 5
would cut the edge count
by ~80%. The planning and
recipe layers could be
separate QuickSlice
instances if needed.
