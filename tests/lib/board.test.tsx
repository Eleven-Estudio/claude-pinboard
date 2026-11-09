import { expect, mock, test } from 'claude-code/testing'

import {
  CHECKLIST,
  PANE,
  START,
  USAGE,
  engine,
  pinCall,
  pinOf,
  reply,
  type Saved,
} from '../support'

test('both boards come back from disk when the session starts again', async ($, on) => {
  engine(on, {
    'session:s1': { pins: [pinOf('Tests', '- [x] Checkout', 2)], updatedAt: Date.now() },
    'project:/work/shop': { pins: [pinOf('Deploy', 'Run the script.', 1)], updatedAt: 1 },
  })
  await $.session.start(START)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /S1 · Tests/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /\[x\] Checkout/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /P1 · Deploy/ })).toBeDefined()
  await ui.unmount()
})

test('a session board untouched for months is dropped at start', async ($, on) => {
  const { disk } = engine(on, {
    'session:old': { pins: [pinOf('Old', 'stale')], updatedAt: 0 },
    'session:recent': { pins: [pinOf('Recent', 'fresh')], updatedAt: Date.now() },
  })
  await $.session.start(START)

  expect(disk.get('session:old')).toBeUndefined()
  expect(disk.get('session:recent')).toBeDefined()
})

test('a pin is written to disk with the checklist as given', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))

  expect((disk.get('session:s1') as Saved).pins[0]?.body).toBe(CHECKLIST)
  expect(disk.get('project:/work/shop')).toBeUndefined()
})

test('a reply pinned without a title gets the small model title', async ($, on) => {
  const { disk } = engine(on)
  const clock = mock.clock(on)
  reply(on, 'Here is what to try.\n\n- [ ] Pay with the test card')
  on('model.complete', () => ({ value: { isAnswered: true, text: '"Checkout test plan."', usage: USAGE } }))
  await $.session.start(START)

  const ran = await $.command.run({ command: 'pin' } as Parameters<typeof $.command.run>[0])
  expect(ran.text).toBe('Pinned "Here is what to try" to the session board.')

  await clock.advance(1)
  expect((disk.get('session:s1') as Saved).pins[0]?.title).toBe('Checkout test plan')
})

test('the guess stays when the small model does not answer', async ($, on) => {
  const { disk } = engine(on)
  const clock = mock.clock(on)
  reply(on, '# Steps\n\n- [ ] Pay')
  on('model.complete', () => ({ value: { isAnswered: false, reason: 'empty-reply', usage: USAGE } }))
  await $.session.start(START)

  await $.command.run({ command: 'pin' } as Parameters<typeof $.command.run>[0])
  await clock.advance(1)
  expect((disk.get('session:s1') as Saved).pins[0]?.title).toBe('Steps')
})

test('nothing changes when the store cannot be written', async ($, on) => {
  const { disk, store } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))
  const before = JSON.stringify([...disk])
  store.isBroken = true

  const denied = await $.tool.call(pinCall('Other', 'text'))
  expect(denied.deny).toContain('could not be saved')
  store.isBroken = false

  expect(JSON.stringify([...disk])).toBe(before)
  const listed = await $.tool.call({ tool: 'mcp__pinboard__list_pins' })
  expect(String(listed.result)).not.toContain('Other')
})

test('a board holds at most 50 pins, and a project board has its own 50', async ($, on) => {
  engine(on)
  await $.session.start(START)
  for (let i = 1; i <= 50; i++) await $.tool.call(pinCall(`Note ${i}`, `text ${i}`))

  const refused = await $.tool.call(pinCall('Note 51', 'text 51'))
  expect(refused.deny).toContain('already has 50 pins')

  // Pinning the same title again replaces a pin, so it is not a new one.
  const replaced = await $.tool.call(pinCall('Note 1', 'new text'))
  expect(String(replaced.result)).toContain('Pinned "Note 1"')

  const project = await $.tool.call(pinCall('Note 51', 'text 51', 'project'))
  expect(String(project.result)).toContain('project board')
})

test('a pin holds at most 20,000 characters', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)

  const refused = await $.tool.call(pinCall('Big', 'x'.repeat(20_001)))
  expect(refused.deny).toContain('at most 20,000 characters')
  expect(disk.get('session:s1')).toBeUndefined()

  const fits = await $.tool.call(pinCall('Fits', 'x'.repeat(20_000)))
  expect(String(fits.result)).toContain('Pinned "Fits"')
})
