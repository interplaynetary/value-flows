// Uploads all query and procedure lexicons to HappyView.
//
// Usage:
//   AIP_TOKEN=<token> DPOP_JWK='{"x":"...","y":"...","d":"..."}' bun upload-lexicons.ts
//
// To get your DPOP_JWK from the browser:
//   1. Open the admin panel, log in
//   2. In browser console, look in IndexedDB or Application → Session Storage
//      for the DPoP key (an ES256/P-256 JWK with x, y, d fields)
//   3. Or intercept a request in Network tab, decode the DPoP JWT header
//      to get x and y, then find d in the JS session state
//
// This assumes your record lexicons are already uploaded.
// It uploads query (list) and procedure (create/update) lexicons
// with target_collection pointing to the corresponding record type.

import { Glob } from "bun";
import { SignJWT, importJWK } from "jose";
import { createHash, randomUUID } from "crypto";

const BASE_URL =
  process.env.HAPPYVIEW_URL || "https://happyview-production.up.railway.app";
const AIP_URL =
  process.env.AIP_URL || "https://aip-production-0438.up.railway.app";
const TOKEN = process.env.AIP_TOKEN;
const DPOP_JWK_STR = process.env.DPOP_JWK;

if (!TOKEN) {
  console.error("Set AIP_TOKEN env var first");
  process.exit(1);
}

if (!DPOP_JWK_STR) {
  console.error(
    'Set DPOP_JWK env var to your P-256 JWK, e.g.: DPOP_JWK=\'{"kty":"EC","crv":"P-256","x":"...","y":"...","d":"..."}\''
  );
  process.exit(1);
}

const dpopJwk = JSON.parse(DPOP_JWK_STR);

// Import the private key for signing DPoP proofs
const privateKey = await importJWK(
  { ...dpopJwk, kty: "EC", crv: "P-256" },
  "ES256"
);

// Public JWK (no private component) for the DPoP JWT header
const publicJwk = {
  kty: "EC" as const,
  crv: "P-256" as const,
  x: dpopJwk.x,
  y: dpopJwk.y,
};

// Track the latest nonce from AIP
let currentNonce: string | undefined;

/**
 * Generate a DPoP proof JWT for a request.
 * The proof targets AIP's userinfo endpoint since HappyView forwards it there.
 */
async function generateDpopProof(): Promise<string> {
  // Access token hash (ath) - SHA-256 of the token, base64url-encoded
  const ath = createHash("sha256")
    .update(TOKEN!)
    .digest("base64url");

  const builder = new SignJWT({
    htm: "GET",
    htu: `${AIP_URL}/oauth/userinfo`,
    ath,
    ...(currentNonce ? { nonce: currentNonce } : {}),
  })
    .setProtectedHeader({
      typ: "dpop+jwt",
      alg: "ES256",
      jwk: publicJwk,
    })
    .setJti(randomUUID())
    .setIssuedAt();

  return builder.sign(privateKey);
}

/**
 * Make an authenticated request to HappyView's admin API.
 * Handles the DPoP nonce retry automatically.
 */
async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // First attempt
  let dpopProof = await generateDpopProof();
  let res = await fetch(url, {
    ...options,
    headers: {
      ...((options.headers as Record<string, string>) || {}),
      Authorization: `DPoP ${TOKEN}`,
      DPoP: dpopProof,
    },
  });

  // If we get a nonce error, retry with the nonce
  if (res.status === 401) {
    const body = await res.text();
    try {
      const parsed = JSON.parse(body);
      if (parsed.dpop_nonce) {
        currentNonce = parsed.dpop_nonce;
        dpopProof = await generateDpopProof();
        res = await fetch(url, {
          ...options,
          headers: {
            ...((options.headers as Record<string, string>) || {}),
            Authorization: `DPoP ${TOKEN}`,
            DPoP: dpopProof,
          },
        });
      }
    } catch {
      // Not JSON, return original response
    }
  }

  // Update nonce from response headers if present
  const newNonce = res.headers.get("dpop-nonce");
  if (newNonce) currentNonce = newNonce;

  return res;
}

// Map each query/procedure NSID to its target record collection.
const lexiconMappings: Record<string, string> = {
  // Agent
  "vf.agent.persons": "vf.agent.person",
  "vf.agent.createPerson": "vf.agent.person",
  "vf.agent.organizations": "vf.agent.organization",
  "vf.agent.createOrganization": "vf.agent.organization",
  "vf.agent.ecologicalAgents": "vf.agent.ecologicalAgent",
  "vf.agent.createEcologicalAgent": "vf.agent.ecologicalAgent",

  // Agreement
  "vf.agreement.agreements": "vf.agreement.agreement",
  "vf.agreement.createAgreement": "vf.agreement.agreement",
  "vf.agreement.agreementBundles": "vf.agreement.agreementBundle",
  "vf.agreement.createAgreementBundle": "vf.agreement.agreementBundle",

  // Geo
  "vf.geo.spatialThings": "vf.geo.spatialThing",
  "vf.geo.createSpatialThing": "vf.geo.spatialThing",

  // Knowledge
  "vf.knowledge.actions": "vf.knowledge.action",
  "vf.knowledge.createAction": "vf.knowledge.action",
  "vf.knowledge.processSpecifications": "vf.knowledge.processSpecification",
  "vf.knowledge.createProcessSpecification":
    "vf.knowledge.processSpecification",
  "vf.knowledge.resourceSpecifications": "vf.knowledge.resourceSpecification",
  "vf.knowledge.createResourceSpecification":
    "vf.knowledge.resourceSpecification",
  "vf.knowledge.units": "vf.knowledge.unit",
  "vf.knowledge.createUnit": "vf.knowledge.unit",

  // Observation
  "vf.observation.economicEvents": "vf.observation.economicEvent",
  "vf.observation.createEconomicEvent": "vf.observation.economicEvent",
  "vf.observation.economicResources": "vf.observation.economicResource",
  "vf.observation.createEconomicResource": "vf.observation.economicResource",

  // Planning
  "vf.planning.claims": "vf.planning.claim",
  "vf.planning.createClaim": "vf.planning.claim",
  "vf.planning.commitments": "vf.planning.commitment",
  "vf.planning.createCommitment": "vf.planning.commitment",
  "vf.planning.intents": "vf.planning.intent",
  "vf.planning.createIntent": "vf.planning.intent",
  "vf.planning.plans": "vf.planning.plan",
  "vf.planning.createPlan": "vf.planning.plan",
  "vf.planning.processes": "vf.planning.process",
  "vf.planning.createProcess": "vf.planning.process",

  // Proposal
  "vf.proposal.proposals": "vf.proposal.proposal",
  "vf.proposal.createProposal": "vf.proposal.proposal",
  "vf.proposal.proposalLists": "vf.proposal.proposalList",
  "vf.proposal.createProposalList": "vf.proposal.proposalList",

  // Recipe
  "vf.recipe.recipes": "vf.recipe.recipe",
  "vf.recipe.createRecipe": "vf.recipe.recipe",
  "vf.recipe.recipeExchanges": "vf.recipe.recipeExchange",
  "vf.recipe.createRecipeExchange": "vf.recipe.recipeExchange",
  "vf.recipe.recipeFlows": "vf.recipe.recipeFlow",
  "vf.recipe.createRecipeFlow": "vf.recipe.recipeFlow",
  "vf.recipe.recipeProcesses": "vf.recipe.recipeProcess",
  "vf.recipe.createRecipeProcess": "vf.recipe.recipeProcess",

  // Resource
  "vf.resource.batchLotRecords": "vf.resource.batchLotRecord",
  "vf.resource.createBatchLotRecord": "vf.resource.batchLotRecord",
};

// Find all lexicon files
const glob = new Glob("lexicons/vf/**/*.json");
const files: string[] = [];
for await (const path of glob.scan(".")) {
  files.push(path);
}

let uploaded = 0;
let skipped = 0;
let failed = 0;

for (const file of files.sort()) {
  const content = await Bun.file(file).json();
  const id = content.id as string;
  const type = content.defs?.main?.type as string;

  // Only upload query and procedure lexicons
  if (type !== "query" && type !== "procedure") continue;

  const targetCollection = lexiconMappings[id];
  if (!targetCollection) {
    console.log(`  SKIP ${id} — no target_collection mapping`);
    skipped++;
    continue;
  }

  const body = {
    lexicon_json: content,
    target_collection: targetCollection,
    backfill: false,
  };

  const res = await authFetch(`${BASE_URL}/admin/lexicons`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.ok) {
    const data = await res.json();
    console.log(
      `  OK ${id} (${type}) -> ${targetCollection} [rev ${data.revision}]`
    );
    uploaded++;
  } else {
    const text = await res.text();
    console.log(`  FAIL ${id} — ${res.status}: ${text}`);
    failed++;
  }
}

console.log(
  `\nDone: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`
);
