import type { Pin } from '../../types'
import { failure, isPaneUp, mutate, openPane, sync } from './board'
import { byScope } from './labels'
import { resolveOpenId } from './open-pin'
import type { Ports } from './ports'

// The commands meant for a key: each one acts on the pane and says nothing in
// the chat. When there is nothing to act on, a toast says so.

// The pins in the order the pane draws them: the session's board, then the project's.
function paneOrder(list: readonly Pin[]): Pin[] {
  return [...byScope(list, 'session'), ...byScope(list, 'project')]
}

// Selects the next card (step 1) or the previous one (step -1), wrapping at the
// ends. With every card closed, next selects the first and previous the last.
export async function selectStep(ports: Ports, step: 1 | -1): Promise<void> {
  await sync(ports)
  const order = paneOrder(await ports.state.readPins())
  if (order.length === 0) return ports.ui.toast('Nothing pinned.')
  const selected = resolveOpenId(await ports.state.readOpenPin(), order)
  const at = order.findIndex(pin => pin.id === selected)
  const next = at === -1 ? (step === 1 ? 0 : order.length - 1) : (at + step + order.length) % order.length
  await ports.state.setOpenPin(order[next]?.id ?? '')
}

// Removes the selected card's pin. Every removal can be undone with undoRemoval.
export async function removeSelected(ports: Ports): Promise<void> {
  await sync(ports)
  const list = await ports.state.readPins()
  const selected = resolveOpenId(await ports.state.readOpenPin(), list)
  if (selected === '') return ports.ui.toast('No pin is selected.')
  try {
    await mutate(ports, current => current.filter(pin => pin.id !== selected))
  } catch (error) {
    ports.ui.toast(failure(error))
  }
}

// Puts back the pins of the last removal, in their place, and selects the
// first. Pressed again, it goes on with the one before, up to MAX_UNDO.
export async function undoRemoval(ports: Ports): Promise<void> {
  const stack = await ports.state.readRemovals()
  const removed = stack.at(-1) ?? []
  if (removed.length === 0) return ports.ui.toast('There is no removal to undo.')
  try {
    await mutate(ports, current => {
      const back = removed.filter(pin => !current.some(one => one.id === pin.id))

      return [...current, ...back].sort((a, b) => a.pinnedAt - b.pinnedAt)
    })
    // mutate stacked nothing (it only adds), so this drops just the undone entry.
    await ports.state.setRemovals((await ports.state.readRemovals()).slice(0, -1))
    await ports.state.setOpenPin(removed[0]?.id ?? '')
    if (!(await ports.state.readIsMinimized()) && !(await isPaneUp(ports))) await openPane(ports)
  } catch (error) {
    ports.ui.toast(failure(error))
  }
}
