import { atom, read, update } from 'claude-code'
import type { EngineInterface } from 'claude-code'

import type { Pin } from '../../types'

// The state library scans a module for the atoms it reads, so the atoms stay
// in this file and the rest of the mod goes through the functions below.

// Change the tag when Pin's fields change: an earlier version's value
// outlives a reload and is then read as empty instead of misread.
const pins = atom({ plugin: 'pinboard', key: 'pins' } as const, [], {
  shape: 'pins-2',
})
// The one card shown open; null until the person picks one (the newest pin
// is open then), '' when they closed every card.
const openPin = atom({ plugin: 'pinboard', key: 'openPin' } as const, null)

export function readPins($: EngineInterface): Promise<Pin[]> {
  return read($, pins)
}

export function updatePins($: EngineInterface, change: (list: readonly Pin[]) => Pin[]): Promise<unknown> {
  return update($, pins, list => change(list))
}

export function readOpenPin($: EngineInterface): Promise<string | null> {
  return read($, openPin)
}

export function setOpenPin($: EngineInterface, id: string): Promise<unknown> {
  return update($, openPin, () => id)
}
