/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { type ValidationResult, BlobRef } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import { validate as _validate } from '../../../lexicons'
import { type $Typed, is$typed as _is$typed, type OmitKey } from '../../../util'

const is$typed = _is$typed,
  validate = _validate
const id = 'org.openassociation.process'

export interface Main {
  $type: 'org.openassociation.process'
  /** All the input flows of a process. */
  hasInput?: string[]
  /** All the output flows of a process. */
  hasOutput?: string[]
  /** The process with its inputs and outputs, or the non-process commitment or intent, is part of the plan. */
  plannedWithin?: string
  /** Scope here means executed in the context of an agent. */
  inScopeOf?: string
  /** The planned or actual beginning date, and time if desired, of a flow or process. */
  hasBeginning?: string
  /** The planned or actual ending date, and time if desired, of a flow or process. */
  hasEnd?: string
  /** An informal or formal textual identifier for an object. Does not imply uniqueness. */
  name?: string
  /** Any useful textual information related to the item. */
  note?: string
  /** The commitment or intent or process is complete or not.  This is irrespective of if the original goal has been met, and indicates simply that no more will be done.  Default false. */
  finished?: boolean
  /** The definition or standard specification for a process. */
  basedOn?: string
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
