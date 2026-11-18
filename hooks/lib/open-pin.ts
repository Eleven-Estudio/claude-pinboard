import type { Pin } from '../../types'
import type { Ports } from './ports'

// The card drawn open. `picked` is what the person chose: '' when they closed
// every card, null when they chose none yet, else a pin id that may be gone.
export function resolveOpenId(picked: string | null, list: readonly Pin[]): string {
  if (picked === '') return ''
  if (picked !== null && list.some(pin => pin.id === picked)) return picked

  return newest(list)?.id ?? ''
}

// The cards drawn unfolded when the person may open several. `stored` is null
// until they fold or unfold one: then only the selected card is open.
export function resolveExpanded(stored: string[] | null, openId: string, list: readonly Pin[]): string[] {
  if (stored === null) return openId === '' ? [] : [openId]

  return stored.filter(id => list.some(pin => pin.id === id))
}

// The card a new pin selects; with many open, it unfolds beside the others.
export async function unfold(ports: Ports, id: string, list: readonly Pin[]): Promise<void> {
  if (ports.settings.openCards === 'one') return ports.state.setOpenPin(id)
  const selected = resolveOpenId(await ports.state.readOpenPin(), list)
  const open = resolveExpanded(await ports.state.readExpandedPins(), selected, list)
  await ports.state.setOpenPin(id)
  if (!open.includes(id)) open.push(id)
  await ports.state.setExpandedPins(open)
}

export function newest(list: readonly Pin[]): Pin | undefined {
  return list.reduce<Pin | undefined>(
    (latest, pin) => (latest === undefined || pin.pinnedAt >= latest.pinnedAt ? pin : latest),
    undefined,
  )
}
