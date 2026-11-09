import type { Pin } from '../../types'
import { progress } from './checklist'
import { byScope, label } from './labels'
import { newest, resolveOpenId } from './open-pin'

// Cells the pin emoji takes beyond its one character, kept free so the line
// never wraps.
const EMOJI_MARGIN = 2

// One line for the minimized band: `📌 3 pinned · S1 Discount Codes 3/14`. It
// names the card open in the pane, else the newest pin, and shortens that
// title, not the progress, to fit `columns`. '' when nothing is pinned.
export function bandText(list: readonly Pin[], picked: string | null, columns: number): string {
  const openId = resolveOpenId(picked, list)
  const pin = list.find(one => one.id === openId) ?? newest(list)
  if (pin === undefined) return ''
  const place = label(pin.scope, byScope(list, pin.scope).indexOf(pin))
  const count = progress(pin.body)
  const head = `📌 ${list.length} pinned · ${place} `
  const tail = count === '' ? '' : ` ${count}`
  const room = columns - EMOJI_MARGIN - head.length - tail.length
  if (room < 4) return `${head}${pin.title}${tail}`.slice(0, Math.max(columns - EMOJI_MARGIN, 1))
  const title = pin.title.length > room ? `${pin.title.slice(0, room - 1)}…` : pin.title

  return `${head}${title}${tail}`
}
