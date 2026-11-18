import { expect, test } from 'claude-code/testing'

import { mutate, startBoards } from '../../hooks/lib/board'
import { removeSelected, selectStep, undoRemoval } from '../../hooks/lib/shortcuts'
import type { Pin } from '../../types'
import { fakePorts } from '../fake-ports'

const pin = (id: string, pinnedAt: number, scope: 'session' | 'project' = 'session'): Pin => ({
  id,
  title: id,
  body: id,
  scope,
  pinnedAt,
})

// Two pins on the session board and one on the project's, saved on disk and loaded.
async function boards() {
  const made = fakePorts({
    stored: {
      'session:s1': { pins: [pin('s-a', 1), pin('s-b', 3)], updatedAt: 1 },
      'project:/work/shop': { pins: [pin('p-a', 2, 'project')], updatedAt: 1 },
    },
  })
  await startBoards(made.ports)

  return made
}

test('next and previous walk the pane order, session board first, and wrap', async () => {
  const { ports, fake } = await boards()
  fake.pins = [pin('s-a', 1), pin('p-a', 2, 'project'), pin('s-b', 3)]
  fake.openPin = 's-a'

  await selectStep(ports, 1)
  expect(fake.openPin).toBe('s-b')
  await selectStep(ports, 1)
  expect(fake.openPin).toBe('p-a')
  await selectStep(ports, 1)
  expect(fake.openPin).toBe('s-a')
  await selectStep(ports, -1)
  expect(fake.openPin).toBe('p-a')
})

test('with every card closed, next picks the first and previous the last', async () => {
  const { ports, fake } = await boards()
  fake.pins = [pin('s-a', 1), pin('p-a', 2, 'project'), pin('s-b', 3)]

  fake.openPin = ''
  await selectStep(ports, 1)
  expect(fake.openPin).toBe('s-a')
  fake.openPin = ''
  await selectStep(ports, -1)
  expect(fake.openPin).toBe('p-a')
})

test('the selected pin is removed, and undo puts it back in its place, selected', async () => {
  const { ports, fake, disk } = await boards()
  fake.openPin = 's-a'

  await removeSelected(ports)
  expect(fake.pins.map(one => one.id)).toEqual(['s-b', 'p-a'])
  expect(disk.get('session:s1')?.pins.map(one => one.id)).toEqual(['s-b'])

  await undoRemoval(ports)
  expect(disk.get('session:s1')?.pins.map(one => one.id)).toEqual(['s-a', 's-b'])
  expect(fake.openPin).toBe('s-a')
  expect(fake.removedPins).toEqual([])
})

test('undo brings back every pin a whole-board removal took', async () => {
  const { ports, fake, disk } = await boards()
  fake.openPin = 's-b'
  await mutate(ports, () => [])
  expect(disk.size).toBe(0)

  await undoRemoval(ports)
  expect(disk.get('session:s1')?.pins.map(one => one.id)).toEqual(['s-a', 's-b'])
  expect(disk.get('project:/work/shop')?.pins.map(one => one.id)).toEqual(['p-a'])
})

test('with nothing to act on, a toast says so', async () => {
  const { ports, toasts } = fakePorts()

  await selectStep(ports, 1)
  await removeSelected(ports)
  await undoRemoval(ports)
  expect(toasts).toEqual(['Nothing pinned.', 'No pin is selected.', 'There is no removal to undo.'])
})
