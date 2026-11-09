import { expect, test } from 'claude-code/testing'

import { addPin, forgetSession, minimize, mutate, restore, startBoards, sync } from '../../hooks/lib/board'
import { fakePorts } from '../fake-ports'

// Microtask turns enough for an unqueued change to get from its start to its read.
const SETTLE_TURNS = 50

const board = (...titles: string[]) => ({
  pins: titles.map((title, index) => ({
    id: title,
    title,
    body: `body ${title}`,
    scope: 'session' as const,
    pinnedAt: index,
  })),
  updatedAt: Date.now(),
})

const titlesOf = (saved: unknown) => (saved as { pins: { title: string }[] }).pins.map(pin => pin.title)

test('a change made while the boards reload waits for the reload and keeps the stored pins', async () => {
  const { ports, fake, disk } = fakePorts({ stored: { 'session:s1': board('Old') } })
  await startBoards(ports)
  // A /clear leaves the list without the session's pins until the next sync.
  await forgetSession(ports)

  // The reload reads the board, then its write to the pins is held.
  let release = () => {}
  fake.holdPinsWrite = new Promise<void>(resolve => {
    release = resolve
  })
  const reached = new Promise<void>(resolve => {
    fake.onPinsWriteHeld = resolve
  })
  const reloaded = sync(ports)
  await reached

  // A pin made now must not start from the list the reload has not replaced.
  const pinned = addPin(ports, { scope: 'session', body: 'added', title: 'New' })
  // Give a change that is not held back time to reach its read of the pins,
  // while the reload's write is still held.
  for (let turn = 0; turn < SETTLE_TURNS; turn++) await Promise.resolve()
  release()
  await Promise.all([reloaded, pinned])

  expect(titlesOf(disk.get('session:s1'))).toEqual(['Old', 'New'])
})

test('a change spanning both boards is undone on disk when one write fails', async () => {
  const { ports, fake, disk } = fakePorts({
    stored: { 'session:s1': board('Mine'), 'project:/work/shop': board('Ours') },
  })
  await startBoards(ports)
  fake.failKey = /^project:/

  await expect(mutate(ports, () => [])).rejects.toThrow('Nothing was changed')
  expect(titlesOf(disk.get('session:s1'))).toEqual(['Mine'])
  expect(fake.pins.map(pin => pin.title).sort()).toEqual(['Mine', 'Ours'])
})

test('when the undo fails too, the person is told and the boards reload from disk', async () => {
  const { ports, fake, disk } = fakePorts({
    stored: { 'session:s1': board('Mine'), 'project:/work/shop': board('Ours') },
  })
  await startBoards(ports)
  // The session board is removed, the project board fails, the undo fails.
  fake.writesLeft = 1

  await expect(mutate(ports, () => [])).rejects.toThrow('may differ from the pane')
  fake.writesLeft = null
  expect(disk.get('session:s1')).toBeUndefined()

  // The next sync shows what the store holds.
  await sync(ports)
  expect(fake.pins.map(pin => pin.title)).toEqual(['Ours'])
})

test('a change is kept when the pane cannot close after the last pin goes', async () => {
  const { ports, fake, disk } = fakePorts({ stored: { 'session:s1': board('Only') } })
  await startBoards(ports)
  fake.isCloseBroken = true

  await mutate(ports, () => [])
  expect(disk.get('session:s1')).toBeUndefined()
  expect(fake.pins).toEqual([])
})

test('the fold is set only after the pane has closed, and cleared only after it has opened', async () => {
  const { ports, fake } = fakePorts()

  fake.isCloseBroken = true
  await expect(minimize(ports)).rejects.toThrow('no surface')
  expect(fake.isMinimized).toBe(false)

  fake.isCloseBroken = false
  await minimize(ports)
  expect(fake.isMinimized).toBe(true)

  await restore(ports)
  expect(fake.isMinimized).toBe(false)
})

test('a new session starts unfolded', async () => {
  const { ports, fake } = fakePorts()
  fake.isMinimized = true

  await forgetSession(ports)
  expect(fake.isMinimized).toBe(false)
})

test('a pin made while minimized leaves the pane closed and says so', async () => {
  const { ports, fake, panes, toasts } = fakePorts()
  fake.isMinimized = true

  const pin = await addPin(ports, { scope: 'session', body: 'text', title: 'Note' })

  expect(pin.isMinimized).toBe(true)
  expect(panes.has('pinboard')).toBe(false)
  expect(toasts).toEqual([])
})
