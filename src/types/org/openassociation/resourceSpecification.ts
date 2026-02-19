/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.resourceSpecification'

export interface Main {
  $type: 'org.openassociation.resourceSpecification'
  /** The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc. */
  image?: string
  /** A comma separated list of uri addresses to images relevant to the resource. */
  imageList?: string[]
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** True if the resource is a currency, money, token, credit, etc. used as a medium of exchange. */
  mediumOfExchange?: boolean
  /** Defines if any resource of that type can be freely substituted for any other resource of that type when used, consumed, traded, etc. */
  substitutable?: boolean
  defaultUnitOfEffort?: UnitOfMeasure
  defaultUnitOfResource?: UnitOfMeasure
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags. */
  resourceClassifiedAs?: string[]
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

export interface UnitOfMeasure {
  $type?: 'org.openassociation.resourceSpecification#unitOfMeasure'
  /** The display label of the unit (e.g. 'kilogram', 'hour'). */
  unitLabel?: string
  /** The display symbol of the unit (e.g. 'kg', 'h'). */
  unitSymbol?: string
}

const hashUnitOfMeasure = 'unitOfMeasure'

export function isUnitOfMeasure<V>(v: V) {
  return is$typed(v, id, hashUnitOfMeasure)
}

export function validateUnitOfMeasure<V>(v: V) {
  return validate<UnitOfMeasure & V>(v, id, hashUnitOfMeasure)
}
