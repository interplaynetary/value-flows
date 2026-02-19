/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.proposal'

export interface Main {
  $type: 'org.openassociation.proposal'
  /** The planned or actual beginning date, and time if desired, of a flow or process. */
  hasBeginning?: string
  /** The planned or actual ending date, and time if desired, of a flow or process. */
  hasEnd?: string
  /** This group of intents contains unit based quantities, which can be multipied to create commitments; commonly seen in a price list or e-commerce. Default false. */
  unitBased?: boolean
  /** The type of proposal, whether offer or request (others may be added as need arises). */
  purpose?: 'offer' | 'request' | (string & {})
  /** The date, and time if desired, the information was agreed to or recorded. */
  created?: string
  eligibleLocation?: Location
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** The primary intent(s) of this published proposal. Would be used in intent matching. */
  publishes?: string[]
  /** The reciprocal intent(s) of this published proposal. Not meant to be used for intent matching. */
  reciprocal?: string[]
  /** The agent(s) to which the proposal or proposal list is published. */
  proposedTo?: string[]
  /** This proposal is part of these lists of proposals. */
  listedIn?: string[]
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

export interface Location {
  $type?: 'org.openassociation.proposal#location'
  /** WGS84 latitude (decimal degrees). */
  lat?: string
  /** WGS84 longitude (decimal degrees). */
  long?: string
  /** WGS84 altitude (decimal meters above the local reference ellipsoid). */
  alt?: string
  /** A textual address that can be mapped using mapping software. */
  mappableAddress?: string
  /** An informal or formal textual identifier for the location. */
  name?: string
}

const hashLocation = 'location'

export function isLocation<V>(v: V) {
  return is$typed(v, id, hashLocation)
}

export function validateLocation<V>(v: V) {
  return validate<Location & V>(v, id, hashLocation)
}
