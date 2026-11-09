import { expect, test } from 'claude-code/testing'

import { CHECKLIST, START, type Saved, engine, LIST_CALL, pinCall, unpinCall } from './support'

test('a pin without text is refused', async ($, on) => {
  engine(on)
  await $.session.start(START)

  expect((await $.tool.call(pinCall('Empty', '   '))).deny).toContain('markdown is required')
})

test('list_pins reads both boards back with the ticks', async ($, on) => {
  engine(on)
  await $.session.start(START)
  expect((await $.tool.call(LIST_CALL)).result).toBe('Nothing is pinned.')

  await $.tool.call(pinCall('Tests', CHECKLIST))
  await $.tool.call(pinCall('Deploy', 'Run the script.', 'project'))
  const listed = String((await $.tool.call(LIST_CALL)).result)

  expect(listed).toContain('# Session board')
  expect(listed).toContain('## S1. Tests')
  expect(listed).toContain('- [ ] Log out')
  expect(listed).toContain('# Project board')
  expect(listed).toContain('## P1. Deploy')
})

test('unpin removes a pin by title, or a whole board', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('One', 'a'))
  await $.tool.call(pinCall('Two', 'b'))
  await $.tool.call(pinCall('Three', 'c', 'project'))

  expect((await $.tool.call(unpinCall({ title: 'One' }))).result).toBe('Removed "One".')
  expect((await $.tool.call(unpinCall({ title: 'Nope' }))).deny).toContain('No pin is titled "Nope"')
  expect((await $.tool.call(unpinCall({ all: true, scope: 'session' }))).result).toBe('Removed 1 pin.')
  expect((await $.tool.call(unpinCall({ all: true }))).result).toBe('Removed 1 pin.')
})

test('a tool is denied when the store cannot be written', async ($, on) => {
  const { disk, store } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', 'a'))
  const before = JSON.stringify([...disk])
  store.isBroken = true

  expect((await $.tool.call(pinCall('Other', 'b'))).deny).toContain('could not be saved')
  expect((await $.tool.call(unpinCall({ title: 'Tests' }))).deny).toContain('could not be saved')
  expect((await $.tool.call(unpinCall({ all: true }))).deny).toContain('could not be saved')

  store.isBroken = false
  expect(JSON.stringify([...disk])).toBe(before)
})

test('a pin made by Claude remembers the tool call that made it', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)
  await $.tool.call({ ...pinCall('Tests', 'a'), tool_use_id: 'toolu_42' } as Parameters<typeof $.tool.call>[0])

  expect((disk.get('session:s1') as Saved).pins[0]?.source).toBe('toolu_42')
})
