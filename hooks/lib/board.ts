import type { Pin, PinScope } from '../../types'
import { byScope } from './labels'
import type { Ports, StoredBoard } from './ports'
import { requestTitle, titleFrom } from './title'

export const PANE = 'pinboard'
const TITLE = 'Pinned'
// Appended to a pin's confirmation when the pane has no room yet.
export const WAITING = ' The pane is waiting for a wider terminal; the person can run /pins to show it.'
// Appended when the pane is minimized and the pin shows in the band.
export const FOLDED = ' The pane is minimized to a band above the prompt; /pins shows it.'

// What follows "Pinned ..." in a command's or tool's one notice.
export function paneNote(pin: { isPlaced: boolean; isMinimized: boolean }): string {
  if (pin.isMinimized) return FOLDED

  return pin.isPlaced ? '' : WAITING
}
export const MAX_PINS_PER_BOARD = 50
export const MAX_BODY_CHARS = 20_000
// Session boards nobody touched in this long are dropped from the store at
// start, so it never fills up. Project boards are kept until unpinned.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

// An error whose message is meant for the person: a limit reached, or a
// board that could not be written.
export class BoardError extends Error {}

export function failure(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// The store keys the pins in the pane's state were loaded from. A module variable on
// purpose: a reload resets it, and the next sync reads the store again,
// which holds every write.
let loaded = { session: '', project: '' }

const sessionKey = (id: string) => `session:${id}`
const projectKey = (root: string) => `project:${root}`

function boardKey(scope: PinScope): string {
  return scope === 'session' ? sessionKey(loaded.session) : projectKey(loaded.project)
}

function isPin(value: unknown): value is Pin {
  if (typeof value !== 'object' || value === null) return false
  const pin = value as Record<string, unknown>

  return typeof pin.id === 'string' && typeof pin.title === 'string' && typeof pin.body === 'string'
}

function savedField(saved: unknown, field: keyof StoredBoard): unknown {
  return typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>)[field] : undefined
}

// A stored pin as the board holds it; `source` is kept only when it is text.
function readPin(pin: Pin, scope: PinScope): Pin {
  const { source, ...rest } = pin
  return typeof source === 'string' ? { ...rest, scope, source } : { ...rest, scope }
}

async function loadSaved(ports: Ports, key: string, scope: PinScope): Promise<Pin[]> {
  const list = savedField(await ports.store.get(key), 'pins')

  return Array.isArray(list) ? list.filter(isPin).map(pin => readPin(pin, scope)) : []
}

async function save(ports: Ports, key: string, list: readonly Pin[]): Promise<void> {
  if (list.length === 0) {
    await ports.store.delete(key)
    return
  }
  const saved: StoredBoard = { pins: [...list], updatedAt: Date.now() }
  await ports.store.set(key, saved)
}

export function openPane(ports: Ports): Promise<boolean> {
  return ports.ui.open({ id: PANE, title: TITLE })
}

export async function isPaneUp(ports: Ports): Promise<boolean> {
  return (await ports.ui.panes()).includes(PANE)
}

// Folds the pane to the band above the prompt.
// The flag is set once the pane has closed, so a failed close leaves it be.
export async function minimize(ports: Ports): Promise<void> {
  await ports.ui.close(PANE)
  await ports.state.setIsMinimized(true)
}

// Puts the pane back where the band was.
export async function restore(ports: Ports): Promise<boolean> {
  const isPlaced = await openPane(ports)
  await ports.state.setIsMinimized(false)

  return isPlaced
}

// Everything that reads or writes the boards runs one task at a time, so a
// change never starts from a list that a load has not finished replacing, and
// two quick presses both land.
let queue: Promise<unknown> = Promise.resolve()

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task)
  queue = run.catch(() => undefined)

  return run
}

// Loads the boards of the session and project in force when they are not
// the ones in the pane's state: at start, after a /clear or /resume, after a reload.
export function sync(ports: Ports): Promise<void> {
  return enqueue(() => syncNow(ports))
}

// For code already running in the queue.
async function syncNow(ports: Ports): Promise<void> {
  const [id, root] = await Promise.all([ports.session.id(), ports.session.root()])
  if (loaded.session === id && loaded.project === root) return
  const [sessionPins, projectPins] = await Promise.all([
    loadSaved(ports, sessionKey(id), 'session'),
    loadSaved(ports, projectKey(root), 'project'),
  ])
  await ports.state.updatePins(() => [...sessionPins, ...projectPins])
  // Only now do the pins in the pane's state match these keys.
  loaded = { session: id, project: root }

  if (sessionPins.length + projectPins.length > 0 && !(await ports.state.readIsMinimized())) {
    if (!(await isPaneUp(ports))) void openPane(ports)
  }
}

async function pruneStaleSessions(ports: Ports, currentId: string): Promise<void> {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const key of await ports.store.keys()) {
    if (!key.startsWith('session:') || key === sessionKey(currentId)) continue
    const updatedAt = savedField(await ports.store.get(key), 'updatedAt')
    if (typeof updatedAt !== 'number' || updatedAt < cutoff) await ports.store.delete(key)
  }
}

// Session start: read both boards again, then drop old session boards.
export function startBoards(ports: Ports): Promise<void> {
  return enqueue(async () => {
    loaded = { session: '', project: '' }
    await syncNow(ports)
    await pruneStaleSessions(ports, loaded.session)
  })
}

// After a /clear or a resume the process goes on under another session id:
// drop this session's pins from the pane's state (they stay on disk with it), unfold the
// pane, and let the next sync load the new ones.
export function forgetSession(ports: Ports): Promise<void> {
  return enqueue(async () => {
    loaded = { session: '', project: '' }
    await ports.state.updatePins(list => byScope(list, 'project'))
    // The next session starts with the pane unfolded.
    await ports.state.setIsMinimized(false)
  })
}

function isSameBoard(before: readonly Pin[], after: readonly Pin[]): boolean {
  return before.length === after.length && before.every((pin, index) => pin === after[index])
}

// Writes the boards that changed, one after the other. If a write throws,
// the boards already written are put back, so the store and the pane's state agree.
async function persist(ports: Ports, current: readonly Pin[], next: readonly Pin[]): Promise<void> {
  const written: { scope: PinScope; before: readonly Pin[] }[] = []
  try {
    for (const scope of ['session', 'project'] as const) {
      const before = byScope(current, scope)
      const after = byScope(next, scope)
      if (isSameBoard(before, after)) continue
      await save(ports, boardKey(scope), after)
      written.push({ scope, before })
    }
  } catch (error) {
    let isRestored = true
    for (const { scope, before } of written) {
      await save(ports, boardKey(scope), before).catch(() => {
        isRestored = false
      })
    }
    if (isRestored) {
      throw new BoardError(`The pins could not be saved (${failure(error)}). Nothing was changed.`)
    }
    // The store may hold half of the change: read it again at the next sync.
    loaded = { session: '', project: '' }
    throw new BoardError(
      `The pins could not be saved (${failure(error)}), and a board on disk may differ from the pane. The pins will reload from disk.`,
    )
  }
}

// Every change goes through here: the right boards loaded, the change made,
// the boards written to disk, and only then the pane's state updated. When the write
// fails this throws and the pane's state is left as it was.
export function mutate(ports: Ports, change: (list: readonly Pin[]) => Pin[]): Promise<void> {
  return enqueue(async () => {
    await syncNow(ports)
    const current = await ports.state.readPins()
    const next = change(current)
    await persist(ports, current, next)
    await ports.state.updatePins(() => next)
    await closePaneWhenEmpty(ports)
  })
}

// No pins left, no pane to keep open. Closing is a courtesy: a failure to
// close never undoes a change that was saved.
async function closePaneWhenEmpty(ports: Ports): Promise<void> {
  try {
    if ((await ports.state.readPins()).length > 0) return
    await ports.state.setIsMinimized(false)
    await ports.ui.close(PANE)
  } catch {
    // The pane stays until the person closes it.
  }
}

export type PinRequest = {
  scope: PinScope
  body: string
  // Given by the person or the model; absent, a guess now and the small
  // model's title once it answers.
  title?: string
  // Where the pin came from, for the pane's jump button.
  source?: string
}

export async function addPin(
  ports: Ports,
  request: PinRequest,
): Promise<{ title: string; isPlaced: boolean; isMinimized: boolean }> {
  const { scope, body } = request
  if (body.length > MAX_BODY_CHARS) {
    throw new BoardError(
      `A pin holds at most ${MAX_BODY_CHARS.toLocaleString('en-US')} characters; this one has ${body.length.toLocaleString('en-US')}.`,
    )
  }
  const title = request.title ?? titleFrom(body)
  let openId = ''
  let isNew = false

  await mutate(ports, list => {
    // The same text pinned again on a board just opens its card; the same
    // title replaces that pin's text.
    const same =
      list.find(pin => pin.scope === scope && pin.body === body) ??
      list.find(pin => pin.scope === scope && pin.title === title)
    if (same !== undefined) {
      openId = same.id
      return list.map(pin =>
        pin.id === same.id ? { ...pin, body, source: request.source ?? pin.source } : pin,
      )
    }
    if (byScope(list, scope).length >= MAX_PINS_PER_BOARD) {
      throw new BoardError(
        `The ${scope} board already has ${MAX_PINS_PER_BOARD} pins. Remove one before pinning another.`,
      )
    }
    openId = newId()
    isNew = true

    return [...list, { id: openId, title, body, scope, pinnedAt: Date.now(), source: request.source }]
  })
  await ports.state.setOpenPin(openId)
  if (isNew && request.title === undefined) suggestTitle(ports, openId, title, body)

  // Minimized, a new pin does not bring the pane back: the band shows it. The
  // caller says so, in the one notice it gives.
  if (await ports.state.readIsMinimized()) return { title, isPlaced: true, isMinimized: true }

  return { title, isPlaced: await openPane(ports), isMinimized: false }
}

function newId(): string {
  return crypto.randomUUID()
}

// Off the caller's dispatch, on a timer: the pin shows at once, and its
// title changes when the model answers, unless the person renamed it.
function suggestTitle(ports: Ports, id: string, guess: string, body: string): void {
  try {
    ports.clock.after(0, () => {
      void (async () => {
        const title = await requestTitle(ports, body)
        if (title === '' || title === guess) return
        await mutate(ports, list =>
          list.map(pin => (pin.id === id && pin.title === guess ? { ...pin, title } : pin)),
        )
      })().catch(() => {
        // The guess stays.
      })
    })
  } catch {
    // No timer here: the guess stays.
  }
}
