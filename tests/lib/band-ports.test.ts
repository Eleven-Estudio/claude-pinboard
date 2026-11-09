import { expect, test } from 'claude-code/testing'

import { bandLine } from '../../hooks/lib/band'
import { foldOnClose } from '../../hooks/lib/close'
import { fakePorts } from '../fake-ports'

const pin = { id: 'a', title: 'Tests', body: '- [x] a\n- [ ] b', scope: 'session', pinnedAt: 1 } as const

test('the band is ours to draw only while minimized with pins', async () => {
  const { ports, fake } = fakePorts()
  fake.pins = [pin]
  expect(await bandLine(ports, 80)).toBeUndefined()

  fake.isMinimized = true
  expect(await bandLine(ports, 80)).toBe('📌 1 pinned · S1 Tests 1/2')

  // Minimized with nothing pinned: the band is left to the engine.
  fake.pins = []
  expect(await bandLine(ports, 80)).toBeUndefined()
})

test('only the person closing a pane that has pins folds it', async () => {
  const { ports, fake } = fakePorts()
  fake.pins = [pin]

  await foldOnClose(ports, 'unload')
  await foldOnClose(ports, 'plugin')
  expect(fake.isMinimized).toBe(false)
  await foldOnClose(ports, 'person')
  expect(fake.isMinimized).toBe(true)

  fake.isMinimized = false
  fake.pins = []
  await foldOnClose(ports, 'person')
  expect(fake.isMinimized).toBe(false)
})
