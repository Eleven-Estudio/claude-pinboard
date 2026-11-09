import type { EngineInterface } from 'claude-code'

import type { Pin, PinScope } from '../../types'
import { byScope } from './labels'
import { readPins, setOpenPin, updatePins } from './state'
import { requestTitle, titleFrom } from './title'

export const PANE = 'pinboard'
const TITLE = 'Pinned'
// Appended to a pin's confirmation when the pane has no room yet.
export const WAITING = ' The pane is waiting for a wider terminal; the person can run /pins to show it.'
// Session boards nobody touched in this long are dropped from the store at
// start, so it never fills up. Project boards are kept until unpinned.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

type Saved = { pins: Pin[]; updatedAt: number }

// The store keys the pins in $.state were loaded from. A module variable on
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

function savedField(saved: unknown, field: keyof Saved): unknown {
  return typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>)[field] : undefined
}

async function loadSaved($: EngineInterface, key: string, scope: PinScope): Promise<Pin[]> {
  const list = savedField(await $.store.get(key), 'pins')

  return Array.isArray(list) ? list.filter(isPin).map(pin => ({ ...pin, scope })) : []
}

async function save($: EngineInterface, key: string, list: readonly Pin[]): Promise<void> {
  if (list.length === 0) {
    await $.store.delete(key)
    return
  }
  const saved: Saved = { pins: [...list], updatedAt: Date.now() }
  await $.store.set(key, saved)
}

export async function openPane($: EngineInterface): Promise<boolean> {
  const opened = await $.ui.open({ id: PANE, title: TITLE })

  return opened.isPlaced
}

// Loads the boards of the session and project in force when they are not
// the ones in $.state: at start, after a /clear or /resume, after a reload.
export async function sync($: EngineInterface): Promise<void> {
  const [id, root] = await Promise.all([$.session.id(), $.session.root()])
  if (loaded.session === id && loaded.project === root) return
  const [sessionPins, projectPins] = await Promise.all([
    loadSaved($, sessionKey(id), 'session'),
    loadSaved($, projectKey(root), 'project'),
  ])
  loaded = { session: id, project: root }
  await updatePins($, () => [...sessionPins, ...projectPins])

  if (sessionPins.length + projectPins.length > 0) {
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (!isUp) void openPane($)
  }
}

async function pruneStaleSessions($: EngineInterface, currentId: string): Promise<void> {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const key of await $.store.keys()) {
    if (!key.startsWith('session:') || key === sessionKey(currentId)) continue
    const updatedAt = savedField(await $.store.get(key), 'updatedAt')
    if (typeof updatedAt !== 'number' || updatedAt < cutoff) await $.store.delete(key)
  }
}

// Session start: read both boards again, then drop old session boards.
export async function startBoards($: EngineInterface): Promise<void> {
  loaded = { session: '', project: '' }
  await sync($)
  await pruneStaleSessions($, loaded.session)
}

// After a /clear or a resume the process goes on under another session id:
// drop this session's pins from $.state (they stay on disk with it) and let
// the next sync load the new ones.
export async function forgetSession($: EngineInterface): Promise<void> {
  loaded = { session: '', project: '' }
  await updatePins($, list => byScope(list, 'project'))
}

async function persist($: EngineInterface): Promise<void> {
  const list = await readPins($)
  await Promise.all([
    save($, boardKey('session'), byScope(list, 'session')),
    save($, boardKey('project'), byScope(list, 'project')),
  ])
}

// Every change goes through here: the right boards loaded, the change made,
// both boards written to disk.
export async function mutate($: EngineInterface, change: (list: readonly Pin[]) => Pin[]): Promise<void> {
  await sync($)
  await updatePins($, list => change(list))
  await persist($)
}

export type PinRequest = {
  scope: PinScope
  body: string
  // Given by the person or the model; absent, a guess now and the small
  // model's title once it answers.
  title?: string
}

export async function addPin(
  $: EngineInterface,
  request: PinRequest,
): Promise<{ title: string; isPlaced: boolean }> {
  const { scope, body } = request
  const title = request.title ?? titleFrom(body)
  let openId = ''
  let isNew = false

  await mutate($, list => {
    // The same text pinned again on a board just opens its card; the same
    // title replaces that pin's text.
    const same =
      list.find(pin => pin.scope === scope && pin.body === body) ??
      list.find(pin => pin.scope === scope && pin.title === title)
    if (same !== undefined) {
      openId = same.id
      return list.map(pin => (pin.id === same.id ? { ...pin, body } : pin))
    }
    openId = newId()
    isNew = true

    return [...list, { id: openId, title, body, scope, pinnedAt: Date.now() }]
  })
  await setOpenPin($, openId)
  if (isNew && request.title === undefined) suggestTitle($, openId, title, body)

  return { title, isPlaced: await openPane($) }
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

// Off the caller's dispatch, on a timer: the pin shows at once, and its
// title changes when the model answers, unless the person renamed it.
function suggestTitle($: EngineInterface, id: string, guess: string, body: string): void {
  try {
    $.clock.after(0, () => {
      void (async () => {
        const title = await requestTitle($, body)
        if (title === '' || title === guess) return
        await mutate($, list =>
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
