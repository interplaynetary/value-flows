// src/lib/types.ts
//
// Clean type aliases for Open Association records and HappyView API response shapes.
// Generated from lexicons — run `bun scripts/lex-query-lex-gen.ts` then
// `bun x @atproto/lex build --lexicons ./lexicons --out ./.src/lexicons --clear` from root to refresh.

// ── API response wrappers ─────────────────────────────────────────────────

/** A single record as returned by a HappyView list or uri query */
export type LexRecord<T> = { uri: string; cid: string; value: T };

/** Paginated list response from HappyView */
export type LexList<T> = { records: LexRecord<T>[]; cursor?: string };

// ── record value types ────────────────────────────────────────────────────
// The `value` field inside each LexRecord.

export type { Main as AgentValue } from '$lex/agent.defs.js';
export type { Main as PersonValue } from '$lex/person.defs.js';
export type { Main as OrganizationValue } from '$lex/organization.defs.js';
export type { Main as EcologicalAgentValue } from '$lex/ecologicalAgent.defs.js';

export type { Main as EconomicEventValue } from '$lex/economicEvent.defs.js';
export type { Main as EconomicResourceValue } from '$lex/economicResource.defs.js';
export type { Main as ProcessValue } from '$lex/process.defs.js';
export type { Main as ProcessSpecificationValue } from '$lex/processSpecification.defs.js';
export type { Main as ResourceSpecificationValue } from '$lex/resourceSpecification.defs.js';

export type { Main as ActionValue } from '$lex/action.defs.js';
export type { Main as UnitValue } from '$lex/unit.defs.js';
export type { Measure as MeasureValue } from '$lex/defs.defs.js';

export type { Main as IntentValue } from '$lex/intent.defs.js';
export type { Main as CommitmentValue } from '$lex/commitment.defs.js';
export type { Main as ClaimValue } from '$lex/claim.defs.js';
export type { Main as PlanValue } from '$lex/plan.defs.js';
export type { Main as ProposalValue } from '$lex/proposal.defs.js';
export type { Main as AgreementValue } from '$lex/agreement.defs.js';

export type { Main as RecipeValue } from '$lex/recipe.defs.js';
export type { Main as RecipeFlowValue } from '$lex/recipeFlow.defs.js';
export type { Main as RecipeProcessValue } from '$lex/recipeProcess.defs.js';

// ── query param types ─────────────────────────────────────────────────────
// Pass to query<T, P>() for typed filter params.

export type { Params as ListAgentsParams } from '$lex/listAgents.defs.js';
export type { Params as ListEconomicEventsParams } from '$lex/listEconomicEvents.defs.js';
export type { Params as ListEconomicResourcesParams } from '$lex/listEconomicResources.defs.js';
export type { Params as ListProcessesParams } from '$lex/listProcesses.defs.js';
export type { Params as ListIntentsParams } from '$lex/listIntents.defs.js';
export type { Params as ListCommitmentsParams } from '$lex/listCommitments.defs.js';
export type { Params as ListActionsParams } from '$lex/listActions.defs.js';
export type { Params as ListUnitsParams } from '$lex/listUnits.defs.js';
