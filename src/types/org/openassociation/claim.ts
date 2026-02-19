/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.claim'

export interface Main {
  $type: 'org.openassociation.claim'
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
  /** The economic agent by whom the intended, committed, or actual economic event is initiated. */
  provider?: string
  /** The economic agent whom the intended, committed, or actual economic event is for. */
  receiver?: string
  /** References an economic event that implied the claim, often based on a prior agreement. */
  triggeredBy?: string
  /** The date, and time if desired, something is expected to be complete. */
  due?: string
  resourceQuantity?: Measure
  effortQuantity?: Measure
  /** The date, and time if desired, the information was agreed to or recorded. */
  created?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false. */
  finished?: boolean
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags. */
  resourceClassifiedAs?: string[]
  resourceConformsTo?: ResourceSpecification
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
  $type?: 'org.openassociation.claim#measure'
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
  $type?: 'org.openassociation.claim#resourceSpecification'
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
