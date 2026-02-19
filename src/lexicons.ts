/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  OrgOpenassociationAgent: {
    lexicon: 1,
    id: 'org.openassociation.agent',
    defs: {
      main: {
        type: 'record',
        description:
          'A functional structure, formal or informal, which can include people and/or other organizations, and has its own agency.  Something called a group is an Organization in Valueflows if it has agency as the group.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            agentType: {
              type: 'string',
              description: 'The type of agent.',
              enum: ['person', 'organization', 'ecologicalAgent'],
            },
            primaryLocation: {
              type: 'ref',
              ref: 'lex:org.openassociation.agent#location',
              description:
                'The main place an agent is located, often an address where activities occur and mail can be sent.',
            },
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            classifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or it can be one or more string classifications such as tags.",
            },
          },
        },
      },
      location: {
        type: 'object',
        properties: {
          lat: {
            type: 'string',
            description: 'WGS84 latitude (decimal degrees).',
          },
          long: {
            type: 'string',
            description: 'WGS84 longitude (decimal degrees).',
          },
          alt: {
            type: 'string',
            description:
              'WGS84 altitude (decimal meters above the local reference ellipsoid).',
          },
          mappableAddress: {
            type: 'string',
            description:
              'A textual address that can be mapped using mapping software.',
          },
          name: {
            type: 'string',
            description:
              'An informal or formal textual identifier for the location.',
          },
        },
      },
    },
  },
  OrgOpenassociationAgreement: {
    lexicon: 1,
    id: 'org.openassociation.agreement',
    defs: {
      main: {
        type: 'record',
        description:
          'A set of reciprocal commitments among economic agents, and/or a set of reciprocal economic events.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            stipulates: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'All the primary commitments that constitute the agreement.',
            },
            stipulatesReciprocal: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'All the reciprocal commitments that constitute the agreement.',
            },
            realizes: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'All the non-reciprocal economic events (with or without commitments) that realize the agreement.',
            },
            realizesReciprocal: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'All the reciprocal economic events (with or without commitments) that realize the agreement.',
            },
            bundledIn: {
              type: 'string',
              format: 'at-uri',
              description:
                'This agreement is bundled with other agreements, for example in an order.',
            },
          },
        },
      },
    },
  },
  OrgOpenassociationAgreementBundle: {
    lexicon: 1,
    id: 'org.openassociation.agreementBundle',
    defs: {
      main: {
        type: 'record',
        description:
          'A grouping of agreements to bundle detailed line item reciprocity.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            bundles: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'All the agreements included in this agreement bundle.',
            },
          },
        },
      },
    },
  },
  OrgOpenassociationClaim: {
    lexicon: 1,
    id: 'org.openassociation.claim',
    defs: {
      main: {
        type: 'record',
        description:
          'A claim for a future economic event(s) in reciprocity for an economic event that already occurred.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              description:
                'Defines the kind of flow, such as consume, produce, work, transfer, etc.',
              knownValues: [
                'accept',
                'cite',
                'combine',
                'consume',
                'copy',
                'deliverService',
                'dropoff',
                'lower',
                'modify',
                'move',
                'pickup',
                'produce',
                'raise',
                'separate',
                'transfer',
                'transferAllRights',
                'transferCustody',
                'use',
                'work',
              ],
            },
            provider: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent by whom the intended, committed, or actual economic event is initiated.',
            },
            receiver: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent whom the intended, committed, or actual economic event is for.',
            },
            triggeredBy: {
              type: 'string',
              format: 'at-uri',
              description:
                'References an economic event that implied the claim, often based on a prior agreement.',
            },
            due: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, something is expected to be complete.',
            },
            resourceQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.claim#measure',
              description:
                'The amount and unit of the economic resource counted or inventoried.',
            },
            effortQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.claim#measure',
              description:
                'The amount and unit of the work or use or citation effort-based action. This is often expressed with a time unit, but also could be cycle counts or other measures of effort or usefulness.',
            },
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            finished: {
              type: 'boolean',
              description:
                'The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false.',
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            resourceConformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.claim#resourceSpecification',
              description:
                'The lowest level resource specification or definition of an existing or potential economic resource, whether one will ever be instantiated or not.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationCommitment: {
    lexicon: 1,
    id: 'org.openassociation.commitment',
    defs: {
      main: {
        type: 'record',
        description:
          'A planned economic flow that has been scheduled or promised by one agent to another agent.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              description:
                'Defines the kind of flow, such as consume, produce, work, transfer, etc.',
              knownValues: [
                'accept',
                'cite',
                'combine',
                'consume',
                'copy',
                'deliverService',
                'dropoff',
                'lower',
                'modify',
                'move',
                'pickup',
                'produce',
                'raise',
                'separate',
                'transfer',
                'transferAllRights',
                'transferCustody',
                'use',
                'work',
              ],
            },
            inputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an input flow to its process.',
            },
            outputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an output flow to its process.',
            },
            plannedWithin: {
              type: 'string',
              format: 'at-uri',
              description:
                'The process with its inputs and outputs, or the non-process commitment or intent, is part of the plan.',
            },
            independentDemandOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'This plan is the way this commitment or intent will be realized.',
            },
            resourceInventoriedAs: {
              type: 'string',
              format: 'at-uri',
              description: 'Economic resource involved in the flow.',
            },
            provider: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent by whom the intended, committed, or actual economic event is initiated.',
            },
            receiver: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent whom the intended, committed, or actual economic event is for.',
            },
            hasBeginning: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual beginning date, and time if desired, of a flow or process.',
            },
            hasEnd: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual ending date, and time if desired, of a flow or process.',
            },
            hasPointInTime: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual date, and time if desired, of a flow; can be used instead of hasBeginning and hasEnd, if so, hasBeginning and hasEnd should be able to return this value.',
            },
            due: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, something is expected to be complete.',
            },
            resourceQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.commitment#measure',
              description:
                'The amount and unit of the economic resource counted or inventoried.',
            },
            effortQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.commitment#measure',
              description:
                'The amount and unit of the work or use or citation effort-based action. This is often expressed with a time unit, but also could be cycle counts or other measures of effort or usefulness.',
            },
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            satisfies: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The intent(s) satisfied fully or partially by an economic event or commitment.',
            },
            finished: {
              type: 'boolean',
              description:
                'The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false.',
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            resourceConformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.commitment#resourceSpecification',
              description:
                'The lowest level resource specification or definition of an existing or potential economic resource, whether one will ever be instantiated or not.',
            },
            stage: {
              type: 'string',
              format: 'at-uri',
              description:
                'The required stage of the desired input economic resource. References the ProcessSpecification of the last process the economic resource went through.',
            },
            state: {
              type: 'string',
              description:
                'The required state of the desired input economic resource, after coming out of a test or review process.',
            },
            clauseOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'This commitment is a primary part of the agreement.',
            },
            reciprocalClauseOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'This commitment is a reciprocal part of the agreement.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationEconomicEvent: {
    lexicon: 1,
    id: 'org.openassociation.economicEvent',
    defs: {
      main: {
        type: 'record',
        description:
          'An observed economic flow, which could reflect creation or a change in the quantity, location, accountability and/or responsibility, of an economic resource, whether material or not.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              description:
                'Defines the kind of flow, such as consume, produce, work, transfer, etc.',
              knownValues: [
                'accept',
                'cite',
                'combine',
                'consume',
                'copy',
                'deliverService',
                'dropoff',
                'lower',
                'modify',
                'move',
                'pickup',
                'produce',
                'raise',
                'separate',
                'transfer',
                'transferAllRights',
                'transferCustody',
                'use',
                'work',
              ],
            },
            inputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an input flow to its process.',
            },
            outputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an output flow to its process.',
            },
            resourceInventoriedAs: {
              type: 'string',
              format: 'at-uri',
              description: 'Economic resource involved in the flow.',
            },
            toResourceInventoriedAs: {
              type: 'string',
              format: 'at-uri',
              description:
                'Additional economic resource on the economic event when needed by the receiver. Used when a transfer or move, or sometimes other actions, requires explicitly identifying an economic resource by the receiver, which is identified differently by the sender.',
            },
            provider: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent by whom the intended, committed, or actual economic event is initiated.',
            },
            receiver: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent whom the intended, committed, or actual economic event is for.',
            },
            corrects: {
              type: 'string',
              format: 'at-uri',
              description:
                'Used when an event was entered incorrectly and needs to be backed out or corrected. (The initial event cannot be changed.)',
            },
            settles: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The claim(s) settled fully or partially by the economic event.',
            },
            hasBeginning: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual beginning date, and time if desired, of a flow or process.',
            },
            hasEnd: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual ending date, and time if desired, of a flow or process.',
            },
            hasPointInTime: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual date, and time if desired, of a flow; can be used instead of hasBeginning and hasEnd, if so, hasBeginning and hasEnd should be able to return this value.',
            },
            resourceQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicEvent#measure',
              description:
                'The amount and unit of the economic resource counted or inventoried.',
            },
            effortQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicEvent#measure',
              description:
                'The amount and unit of the work or use or citation effort-based action. This is often expressed with a time unit, but also could be cycle counts or other measures of effort or usefulness.',
            },
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            toLocation: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicEvent#location',
              description: 'The new location of the receiver resource.',
            },
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            fulfills: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The commitment(s) fulfilled completely or partially by an economic event.',
            },
            satisfies: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The intent(s) satisfied fully or partially by an economic event or commitment.',
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            resourceConformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicEvent#resourceSpecification',
              description:
                'The lowest level resource specification or definition of an existing or potential economic resource, whether one will ever be instantiated or not.',
            },
            state: {
              type: 'string',
              description:
                'The required state of the desired input economic resource, after coming out of a test or review process.',
            },
            realizationOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'This non-reciprocal economic event occurs as part of this agreement.',
            },
            reciprocalRealizationOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'This reciprocal economic event occurs as part of this agreement.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      location: {
        type: 'object',
        properties: {
          lat: {
            type: 'string',
            description: 'WGS84 latitude (decimal degrees).',
          },
          long: {
            type: 'string',
            description: 'WGS84 longitude (decimal degrees).',
          },
          alt: {
            type: 'string',
            description:
              'WGS84 altitude (decimal meters above the local reference ellipsoid).',
          },
          mappableAddress: {
            type: 'string',
            description:
              'A textual address that can be mapped using mapping software.',
          },
          name: {
            type: 'string',
            description:
              'An informal or formal textual identifier for the location.',
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationEconomicResource: {
    lexicon: 1,
    id: 'org.openassociation.economicResource',
    defs: {
      main: {
        type: 'record',
        description:
          'Economic or environmental things (material or digital), media of exchange, which agents agree should be accounted for and which can be inventoried.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            containedIn: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'Used when an economic resource contains units also defined as separate economic resources, for example a tool kit or a package of resources for shipping.',
            },
            contains: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'An economic resource contains at least one other economic resource, for example a tool kit or package of resources for shipping.',
            },
            primaryAccountable: {
              type: 'string',
              format: 'did',
              description:
                'The agent currently with primary rights and responsibilites for the economic resource. It is the agent that is associated with the accountingQuantity of the economic resource.',
            },
            accountingQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#measure',
              description:
                'The current amount and unit of the economic resource for which the agent has primary rights and responsibilities, sometimes thought of as ownership. This can be either stored or derived from economic events affecting the resource.',
            },
            onhandQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#measure',
              description:
                'The current amount and unit of the economic resource which is under direct control of the agent.  It may be more or less than the accounting quantity. This can be either stored or derived from economic events affecting the resource.',
            },
            currentLocation: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#location',
              description:
                'The current physical location of an economic resource.',
            },
            currentVirtualLocation: {
              type: 'string',
              format: 'uri',
              description:
                'The current virtual place a digital economic resource is located. Usually used for documents, code, or other electronic resource.',
            },
            currentCurrencyLocation: {
              type: 'string',
              description:
                'The current virtual place a currency economic resource is located, for example the address for a bank account, crypto wallet, etc., in a domain standard format.',
            },
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            imageList: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description:
                'A comma separated list of uri addresses to images relevant to the resource.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            trackingIdentifier: {
              type: 'string',
              description:
                'Any identifier used to track a singular resource, such as a serial number or VIN.',
            },
            ofBatchLot: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#batchLot',
              description:
                'The batch lot record of this resource, if it is a batch or lot resource.',
            },
            unitOfEffort: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#unitOfMeasure',
              description:
                'The unit used for use or work or sometimes cite actions.',
            },
            classifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or it can be one or more string classifications such as tags.",
            },
            conformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.economicResource#resourceSpecification',
              description:
                'The primary resource specification or definition of an existing or potential economic resource.',
            },
            stage: {
              type: 'string',
              format: 'at-uri',
              description:
                'The required stage of the desired input economic resource. References the ProcessSpecification of the last process the economic resource went through.',
            },
            state: {
              type: 'string',
              description:
                'The required state of the desired input economic resource, after coming out of a test or review process.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      location: {
        type: 'object',
        properties: {
          lat: {
            type: 'string',
            description: 'WGS84 latitude (decimal degrees).',
          },
          long: {
            type: 'string',
            description: 'WGS84 longitude (decimal degrees).',
          },
          alt: {
            type: 'string',
            description:
              'WGS84 altitude (decimal meters above the local reference ellipsoid).',
          },
          mappableAddress: {
            type: 'string',
            description:
              'A textual address that can be mapped using mapping software.',
          },
          name: {
            type: 'string',
            description:
              'An informal or formal textual identifier for the location.',
          },
        },
      },
      batchLot: {
        type: 'object',
        properties: {
          batchLotCode: {
            type: 'string',
            description: 'The code or identifier for this batch or lot.',
          },
          expirationDate: {
            type: 'string',
            format: 'datetime',
            description:
              'The date after which the resource should no longer be used or consumed.',
          },
        },
      },
      unitOfMeasure: {
        type: 'object',
        properties: {
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description: "The display symbol of the unit (e.g. 'kg', 'h').",
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationIntent: {
    lexicon: 1,
    id: 'org.openassociation.intent',
    defs: {
      main: {
        type: 'record',
        description:
          'A desired or proposed or planned or estimated economic flow, usually with only one agent associated, which could become a commitment and/or economic event.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              description:
                'Defines the kind of flow, such as consume, produce, work, transfer, etc.',
              knownValues: [
                'accept',
                'cite',
                'combine',
                'consume',
                'copy',
                'deliverService',
                'dropoff',
                'lower',
                'modify',
                'move',
                'pickup',
                'produce',
                'raise',
                'separate',
                'transfer',
                'transferAllRights',
                'transferCustody',
                'use',
                'work',
              ],
            },
            inputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an input flow to its process.',
            },
            outputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an output flow to its process.',
            },
            plannedWithin: {
              type: 'string',
              format: 'at-uri',
              description:
                'The process with its inputs and outputs, or the non-process commitment or intent, is part of the plan.',
            },
            resourceInventoriedAs: {
              type: 'string',
              format: 'at-uri',
              description: 'Economic resource involved in the flow.',
            },
            provider: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent by whom the intended, committed, or actual economic event is initiated.',
            },
            receiver: {
              type: 'string',
              format: 'did',
              description:
                'The economic agent whom the intended, committed, or actual economic event is for.',
            },
            hasBeginning: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual beginning date, and time if desired, of a flow or process.',
            },
            hasEnd: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual ending date, and time if desired, of a flow or process.',
            },
            hasPointInTime: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual date, and time if desired, of a flow; can be used instead of hasBeginning and hasEnd, if so, hasBeginning and hasEnd should be able to return this value.',
            },
            due: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, something is expected to be complete.',
            },
            resourceQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.intent#measure',
              description:
                'The amount and unit of the economic resource counted or inventoried.',
            },
            effortQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.intent#measure',
              description:
                'The amount and unit of the work or use or citation effort-based action. This is often expressed with a time unit, but also could be cycle counts or other measures of effort or usefulness.',
            },
            availableQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.intent#measure',
              description:
                'The amount and unit of the offered resource currently available.',
            },
            minimumQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.intent#measure',
              description:
                'The minimum required order amount and unit of the offered resource.',
            },
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            imageList: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description:
                'A comma separated list of uri addresses to images relevant to the resource.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            finished: {
              type: 'boolean',
              description:
                'The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false.',
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            resourceConformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.intent#resourceSpecification',
              description:
                'The lowest level resource specification or definition of an existing or potential economic resource, whether one will ever be instantiated or not.',
            },
            stage: {
              type: 'string',
              format: 'at-uri',
              description:
                'The required stage of the desired input economic resource. References the ProcessSpecification of the last process the economic resource went through.',
            },
            state: {
              type: 'string',
              description:
                'The required state of the desired input economic resource, after coming out of a test or review process.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationPlan: {
    lexicon: 1,
    id: 'org.openassociation.plan',
    defs: {
      main: {
        type: 'record',
        description:
          'A logical collection of processes, with optional connected agreements, that constitute a body of scheduled work with defined deliverable(s).',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            planIncludes: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The processes and and non-process commitments/intents that constitute the plan.',
            },
            hasIndependentDemand: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The commitments and/or intents which this plan was created to deliver.',
            },
            due: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, something is expected to be complete.',
            },
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
          },
        },
      },
    },
  },
  OrgOpenassociationProcess: {
    lexicon: 1,
    id: 'org.openassociation.process',
    defs: {
      main: {
        type: 'record',
        description:
          'An activity that changes inputs into outputs, by transforming or transporting economic resource(s).',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            hasInput: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the input flows of a process.',
            },
            hasOutput: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the output flows of a process.',
            },
            plannedWithin: {
              type: 'string',
              format: 'at-uri',
              description:
                'The process with its inputs and outputs, or the non-process commitment or intent, is part of the plan.',
            },
            inScopeOf: {
              type: 'string',
              format: 'did',
              description:
                'Scope here means executed in the context of an agent.',
            },
            hasBeginning: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual beginning date, and time if desired, of a flow or process.',
            },
            hasEnd: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual ending date, and time if desired, of a flow or process.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            finished: {
              type: 'boolean',
              description:
                'The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false.',
            },
            basedOn: {
              type: 'string',
              format: 'at-uri',
              description:
                'The definition or standard specification for a process.',
            },
            classifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or it can be one or more string classifications such as tags.",
            },
          },
        },
      },
    },
  },
  OrgOpenassociationProcessSpecification: {
    lexicon: 1,
    id: 'org.openassociation.processSpecification',
    defs: {
      main: {
        type: 'record',
        description: 'Specifies the kind of process.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
          },
        },
      },
    },
  },
  OrgOpenassociationProposal: {
    lexicon: 1,
    id: 'org.openassociation.proposal',
    defs: {
      main: {
        type: 'record',
        description:
          'Published requests or offers, sometimes with what is expected in return.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            hasBeginning: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual beginning date, and time if desired, of a flow or process.',
            },
            hasEnd: {
              type: 'string',
              format: 'datetime',
              description:
                'The planned or actual ending date, and time if desired, of a flow or process.',
            },
            unitBased: {
              type: 'boolean',
              description:
                'This group of intents contains unit based quantities, which can be multipied to create commitments; commonly seen in a price list or e-commerce. Default false.',
            },
            purpose: {
              type: 'string',
              description:
                'The type of proposal, whether offer or request (others may be added as need arises).',
              knownValues: ['offer', 'request'],
            },
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            eligibleLocation: {
              type: 'ref',
              ref: 'lex:org.openassociation.proposal#location',
              description: 'Location or area where the proposal is valid.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            publishes: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The primary intent(s) of this published proposal. Would be used in intent matching.',
            },
            reciprocal: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The reciprocal intent(s) of this published proposal. Not meant to be used for intent matching.',
            },
            proposedTo: {
              type: 'array',
              items: {
                type: 'string',
                format: 'did',
              },
              description:
                'The agent(s) to which the proposal or proposal list is published.',
            },
            listedIn: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'This proposal is part of these lists of proposals.',
            },
          },
        },
      },
      location: {
        type: 'object',
        properties: {
          lat: {
            type: 'string',
            description: 'WGS84 latitude (decimal degrees).',
          },
          long: {
            type: 'string',
            description: 'WGS84 longitude (decimal degrees).',
          },
          alt: {
            type: 'string',
            description:
              'WGS84 altitude (decimal meters above the local reference ellipsoid).',
          },
          mappableAddress: {
            type: 'string',
            description:
              'A textual address that can be mapped using mapping software.',
          },
          name: {
            type: 'string',
            description:
              'An informal or formal textual identifier for the location.',
          },
        },
      },
    },
  },
  OrgOpenassociationProposalList: {
    lexicon: 1,
    id: 'org.openassociation.proposalList',
    defs: {
      main: {
        type: 'record',
        description: 'A grouping of proposals, for publishing as a list.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            created: {
              type: 'string',
              format: 'datetime',
              description:
                'The date, and time if desired, the information was agreed to or recorded.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            proposedTo: {
              type: 'array',
              items: {
                type: 'string',
                format: 'did',
              },
              description:
                'The agent(s) to which the proposal or proposal list is published.',
            },
            lists: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the proposals included in this proposal list.',
            },
          },
        },
      },
    },
  },
  OrgOpenassociationRecipe: {
    lexicon: 1,
    id: 'org.openassociation.recipe',
    defs: {
      main: {
        type: 'record',
        description:
          'Optional instance of a recipe which directly specifies the recipe processes included.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            primaryOutput: {
              type: 'string',
              format: 'at-uri',
              description:
                'The main type of resource the recipe is intended to produce or deliver.',
            },
            recipeIncludes: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description:
                'The collection of processes needed for this recipe.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
          },
        },
      },
    },
  },
  OrgOpenassociationRecipeExchange: {
    lexicon: 1,
    id: 'org.openassociation.recipeExchange',
    defs: {
      main: {
        type: 'record',
        description:
          'Specifies an exchange type agreement as part of a recipe.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            recipeStipulates: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the primary clauses of a recipe exchange.',
            },
            recipeStipulatesReciprocal: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the reciprocal clauses of a recipe exchange.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
          },
        },
      },
    },
  },
  OrgOpenassociationRecipeFlow: {
    lexicon: 1,
    id: 'org.openassociation.recipeFlow',
    defs: {
      main: {
        type: 'record',
        description:
          'The specification of a resource inflow to, or outflow from, a recipe process; and/or a clause, or reciprocal clause, of a recipe exchange.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['action'],
          properties: {
            action: {
              type: 'string',
              description:
                'Defines the kind of flow, such as consume, produce, work, transfer, etc.',
              knownValues: [
                'accept',
                'cite',
                'combine',
                'consume',
                'copy',
                'deliverService',
                'dropoff',
                'lower',
                'modify',
                'move',
                'pickup',
                'produce',
                'raise',
                'separate',
                'transfer',
                'transferAllRights',
                'transferCustody',
                'use',
                'work',
              ],
            },
            recipeInputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an input flow to its process in a recipe.',
            },
            recipeOutputOf: {
              type: 'string',
              format: 'at-uri',
              description: 'Relates an output flow to its process in a recipe.',
            },
            recipeClauseOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'Relates a flow to its exchange agreement in a recipe.',
            },
            recipeReciprocalClauseOf: {
              type: 'string',
              format: 'at-uri',
              description:
                'Relates a reciprocal flow to its exchange agreement in a recipe.',
            },
            resourceQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.recipeFlow#measure',
              description:
                'The amount and unit of the economic resource counted or inventoried.',
            },
            effortQuantity: {
              type: 'ref',
              ref: 'lex:org.openassociation.recipeFlow#measure',
              description:
                'The amount and unit of the work or use or citation effort-based action. This is often expressed with a time unit, but also could be cycle counts or other measures of effort or usefulness.',
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            resourceConformsTo: {
              type: 'ref',
              ref: 'lex:org.openassociation.recipeFlow#resourceSpecification',
              description:
                'The lowest level resource specification or definition of an existing or potential economic resource, whether one will ever be instantiated or not.',
            },
            stage: {
              type: 'string',
              format: 'at-uri',
              description:
                'The required stage of the desired input economic resource. References the ProcessSpecification of the last process the economic resource went through.',
            },
            state: {
              type: 'string',
              description:
                'The required state of the desired input economic resource, after coming out of a test or review process.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
      resourceSpecification: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name of the resource specification.',
          },
          uri: {
            type: 'string',
            format: 'at-uri',
            description: 'AT-URI link to the ResourceSpecification record.',
          },
        },
      },
    },
  },
  OrgOpenassociationRecipeProcess: {
    lexicon: 1,
    id: 'org.openassociation.recipeProcess',
    defs: {
      main: {
        type: 'record',
        description:
          'Specifies a process in a recipe for use in planning from recipe.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            hasRecipeInput: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the inputs of a recipe process.',
            },
            hasRecipeOutput: {
              type: 'array',
              items: {
                type: 'string',
                format: 'at-uri',
              },
              description: 'All the outputs of a recipe process.',
            },
            hasDuration: {
              type: 'ref',
              ref: 'lex:org.openassociation.recipeProcess#measure',
              description: 'The temporal extent of the process.',
            },
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            processClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
            processConformsTo: {
              type: 'string',
              format: 'at-uri',
              description:
                'The standard specification or definition of a type of process.',
            },
          },
        },
      },
      measure: {
        type: 'object',
        description:
          'A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers.',
        required: ['hasNumericalValue'],
        properties: {
          hasNumericalValue: {
            type: 'integer',
            description: 'The numeric value (numerator).',
          },
          hasDenominator: {
            type: 'integer',
            description:
              'The denominator for fractional values. Default 1 if omitted.',
          },
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit of measure (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description:
              "The display symbol of the unit of measure (e.g. 'kg', 'h').",
          },
        },
      },
    },
  },
  OrgOpenassociationResourceSpecification: {
    lexicon: 1,
    id: 'org.openassociation.resourceSpecification',
    defs: {
      main: {
        type: 'record',
        description:
          'Specifies the kind of economic or environmental resource, even if the resource is not instantiated as an EconomicResource. Could define a material or digital thing, service, medium of exchange or currency, skill or type of work.',
        key: 'tid',
        record: {
          type: 'object',
          properties: {
            image: {
              type: 'string',
              format: 'uri',
              description:
                'The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc.',
            },
            imageList: {
              type: 'array',
              items: {
                type: 'string',
                format: 'uri',
              },
              description:
                'A comma separated list of uri addresses to images relevant to the resource.',
            },
            name: {
              type: 'string',
              description:
                'An informal or formal textual identifier for an object. Does not imply uniqueness.',
              maxGraphemes: 640,
            },
            note: {
              type: 'string',
              description:
                'Any useful textual information related to the item.',
              maxGraphemes: 10000,
            },
            mediumOfExchange: {
              type: 'boolean',
              description:
                'True if the resource is a currency, money, token, credit, etc. used as a medium of exchange.',
            },
            substitutable: {
              type: 'boolean',
              description:
                'Defines if any resource of that type can be freely substituted for any other resource of that type when used, consumed, traded, etc.',
            },
            defaultUnitOfEffort: {
              type: 'ref',
              ref: 'lex:org.openassociation.resourceSpecification#unitOfMeasure',
              description: 'The default unit used for use or work.',
            },
            defaultUnitOfResource: {
              type: 'ref',
              ref: 'lex:org.openassociation.resourceSpecification#unitOfMeasure',
              description: 'The default unit used for the resource itself.',
            },
            resourceClassifiedAs: {
              type: 'array',
              items: {
                type: 'string',
              },
              description:
                "References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags.",
            },
          },
        },
      },
      unitOfMeasure: {
        type: 'object',
        properties: {
          unitLabel: {
            type: 'string',
            description:
              "The display label of the unit (e.g. 'kilogram', 'hour').",
          },
          unitSymbol: {
            type: 'string',
            description: "The display symbol of the unit (e.g. 'kg', 'h').",
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  OrgOpenassociationAgent: 'org.openassociation.agent',
  OrgOpenassociationAgreement: 'org.openassociation.agreement',
  OrgOpenassociationAgreementBundle: 'org.openassociation.agreementBundle',
  OrgOpenassociationClaim: 'org.openassociation.claim',
  OrgOpenassociationCommitment: 'org.openassociation.commitment',
  OrgOpenassociationEconomicEvent: 'org.openassociation.economicEvent',
  OrgOpenassociationEconomicResource: 'org.openassociation.economicResource',
  OrgOpenassociationIntent: 'org.openassociation.intent',
  OrgOpenassociationPlan: 'org.openassociation.plan',
  OrgOpenassociationProcess: 'org.openassociation.process',
  OrgOpenassociationProcessSpecification:
    'org.openassociation.processSpecification',
  OrgOpenassociationProposal: 'org.openassociation.proposal',
  OrgOpenassociationProposalList: 'org.openassociation.proposalList',
  OrgOpenassociationRecipe: 'org.openassociation.recipe',
  OrgOpenassociationRecipeExchange: 'org.openassociation.recipeExchange',
  OrgOpenassociationRecipeFlow: 'org.openassociation.recipeFlow',
  OrgOpenassociationRecipeProcess: 'org.openassociation.recipeProcess',
  OrgOpenassociationResourceSpecification:
    'org.openassociation.resourceSpecification',
} as const
