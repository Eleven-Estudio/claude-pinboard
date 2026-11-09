import type { Pin } from '../../types'

// The card drawn open. `picked` is what the person chose: '' when they closed
// every card, null when they chose none yet, else a pin id that may be gone.
export function resolveOpenId(picked: string | null, list: readonly Pin[]): string {
  if (picked === '') return ''
  if (picked !== null && list.some(pin => pin.id === picked)) return picked

  return newest(list)?.id ?? ''
}

export function newest(list: readonly Pin[]): Pin | undefined {
  return list.reduce<Pin | undefined>(
    (latest, pin) => (latest === undefined || pin.pinnedAt >= latest.pinnedAt ? pin : latest),
    undefined,
  )
}
