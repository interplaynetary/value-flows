/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.plan'

export interface Main {
  $type: 'org.openassociation.plan'
  /** The processes and and non-process commitments/intents that constitute the plan. */
  planIncludes?: string[]
  /** The commitments and/or intents which this plan was created to deliver. */
  hasIndependentDemand?: string[]
  /** The date, and time if desired, something is expected to be complete. */
  due?: string
  /** The date, and time if desired, the information was agreed to or recorded. */
  created?: string
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
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
