/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.economicResource'

export interface Main {
  $type: 'org.openassociation.economicResource'
  /** Used when an economic resource contains units also defined as separate economic resources, for example a tool kit or a package of resources for shipping. */
  containedIn?: string[]
  /** An economic resource contains at least one other economic resource, for example a tool kit or package of resources for shipping. */
  contains?: string[]
  /** The agent currently with primary rights and responsibilites for the economic resource. It is the agent that is associated with the accountingQuantity of the economic resource. */
  primaryAccountable?: string
  accountingQuantity?: Measure
  onhandQuantity?: Measure
  currentLocation?: Location
  /** The current virtual place a digital economic resource is located. Usually used for documents, code, or other electronic resource. */
  currentVirtualLocation?: string
  /** The current virtual place a currency economic resource is located, for example the address for a bank account, crypto wallet, etc., in a domain standard format. */
  currentCurrencyLocation?: string
  /** The uri to an image relevant to the entity, such as a logo, avatar, photo, diagram, etc. */
  image?: string
  /** A comma separated list of uri addresses to images relevant to the resource. */
  imageList?: string[]
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** Any identifier used to track a singular resource, such as a serial number or VIN. */
  trackingIdentifier?: string
  ofBatchLot?: BatchLot
  unitOfEffort?: UnitOfMeasure
  /** References one or more uri's for a concept in a common taxonomy or other classification scheme for purposes of categorization or grouping; or it can be one or more string classifications such as tags. */
  classifiedAs?: string[]
  conformsTo?: ResourceSpecification
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
  $type?: 'org.openassociation.economicResource#measure'
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

export interface Location {
  $type?: 'org.openassociation.economicResource#location'
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

export interface BatchLot {
  $type?: 'org.openassociation.economicResource#batchLot'
  /** The code or identifier for this batch or lot. */
  batchLotCode?: string
  /** The date after which the resource should no longer be used or consumed. */
  expirationDate?: string
}

const hashBatchLot = 'batchLot'

export function isBatchLot<V>(v: V) {
  return is$typed(v, id, hashBatchLot)
}

export function validateBatchLot<V>(v: V) {
  return validate<BatchLot & V>(v, id, hashBatchLot)
}

export interface UnitOfMeasure {
  $type?: 'org.openassociation.economicResource#unitOfMeasure'
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

export interface ResourceSpecification {
  $type?: 'org.openassociation.economicResource#resourceSpecification'
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
