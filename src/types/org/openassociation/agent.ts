/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.agent'

export interface Main {
  $type: 'org.openassociation.agent'
  /** The type of agent. */
  agentType?: 'person' | 'organization' | 'ecologicalAgent'
  primaryLocation?: Location
  /** The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc. */
  image?: string
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or it can be one or more string classifications such as tags. */
  classifiedAs?: string[]
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
  $type?: 'org.openassociation.agent#location'
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
