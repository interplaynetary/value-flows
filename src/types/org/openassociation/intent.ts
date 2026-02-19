/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.intent'

export interface Main {
  $type: 'org.openassociation.intent'
  /** Defines the kind of flow, such as consume, produce, work, transfer, etc. */
  action:
    | 'accept'
    | 'cite'
    | 'combine'
    | 'consume'
    | 'copy'
    | 'deliverService'
    | 'dropoff'
    | 'lower'
    | 'modify'
    | 'move'
    | 'pickup'
    | 'produce'
    | 'raise'
    | 'separate'
    | 'transfer'
    | 'transferAllRights'
    | 'transferCustody'
    | 'use'
    | 'work'
    | (string & {})
  /** Relates an input flow to its process. */
  inputOf?: string
  /** Relates an output flow to its process. */
  outputOf?: string
  /** The process with its inputs and outputs, or the non-process commitment or intent, is part of the plan. */
  plannedWithin?: string
  /** Economic resource involved in the flow. */
  resourceInventoriedAs?: string
  /** The economic agent by whom the intended, committed, or actual economic event is initiated. */
  provider?: string
  /** The economic agent whom the intended, committed, or actual economic event is for. */
  receiver?: string
  /** The planned or actual beginning date, and time if desired, of a flow or process. */
  hasBeginning?: string
  /** The planned or actual ending date, and time if desired, of a flow or process. */
  hasEnd?: string
  /** The planned or actual date, and time if desired, of a flow; can be used instead of hasBeginning and hasEnd, if so, hasBeginning and hasEnd should be able to return this value. */
  hasPointInTime?: string
  /** The date, and time if desired, something is expected to be complete. */
  due?: string
  resourceQuantity?: Measure
  effortQuantity?: Measure
  availableQuantity?: Measure
  minimumQuantity?: Measure
  /** The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc. */
  image?: string
  /** A comma separated list of uri addresses to images relevant to the resource. */
  imageList?: string[]
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false. */
  finished?: boolean
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags. */
  resourceClassifiedAs?: string[]
  resourceConformsTo?: ResourceSpecification
  /** The required stage of the desired input economic resource. References the ProcessSpecification of the last process the economic resource went through. */
  stage?: string
  /** The required state of the desired input economic resource, after coming out of a test or review process. */
  state?: string
  [k: string]: unknown
}

const hashMain = 'main'

export function isMain<V>(v: V) {
  return is$typed(v, id, hashMain)
}

export function validateMain<V>(v: V) {
  return validate<Main & V>(v, id, hashMain, true)
}

export {
  type Main as Record,
  isMain as isRecord,
  validateMain as validateRecord,
}

/** A quantity expressed as a numeric value with a unit of measure. AT Protocol does not support floats, so the value is represented as numerator/denominator integers. */
export interface Measure {
  $type?: 'org.openassociation.intent#measure'
  /** The numeric value (numerator). */
  hasNumericalValue: number
  /** The denominator for fractional values. Default 1 if omitted. */
  hasDenominator?: number
  /** The display label of the unit of measure (e.g. 'kilogram', 'hour'). */
  unitLabel?: string
  /** The display symbol of the unit of measure (e.g. 'kg', 'h'). */
  unitSymbol?: string
}

const hashMeasure = 'measure'

export function isMeasure<V>(v: V) {
  return is$typed(v, id, hashMeasure)
}

export function validateMeasure<V>(v: V) {
  return validate<Measure & V>(v, id, hashMeasure)
}

export interface ResourceSpecification {
  $type?: 'org.openassociation.intent#resourceSpecification'
  /** Display name of the resource specification. */
  name?: string
  /** AT-URI link to the ResourceSpecification record. */
  uri?: string
}

const hashResourceSpecification = 'resourceSpecification'

export function isResourceSpecification<V>(v: V) {
  return is$typed(v, id, hashResourceSpecification)
}

export function validateResourceSpecification<V>(v: V) {
  return validate<ResourceSpecification & V>(v, id, hashResourceSpecification)
}
