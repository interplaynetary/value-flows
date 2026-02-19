/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.recipeProcess'

export interface Main {
  $type: 'org.openassociation.recipeProcess'
  /** All the inputs of a recipe process. */
  hasRecipeInput?: string[]
  /** All the outputs of a recipe process. */
  hasRecipeOutput?: string[]
  hasDuration?: Measure
  /** The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc. */
  image?: string
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or can be one or more string classifications such as tags. */
  processClassifiedAs?: string[]
  /** The standard specification or definition of a type of process. */
  processConformsTo?: string
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
  $type?: 'org.openassociation.recipeProcess#measure'
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
