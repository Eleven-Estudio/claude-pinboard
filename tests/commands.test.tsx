import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { PANE, START, type Saved, engine, engineRow, pinCall, pinOf, reply } from './support'

type Ctx = Parameters<TestBody>[0]

const run = ($: Ctx, command: string, args?: string) =>
  $.command.run({ command, args } as Parameters<Ctx['command']['run']>[0])

test('/pin project keeps the reply on the project board', async ($, on) => {
  const { disk } = engine(on)
  reply(on, '# Deploy\n\nRun the release script.')
  await $.session.start(START)

  const ran = await run($, 'pin', 'project Deploy notes')
  expect(ran.text).toBe('Pinned "Deploy notes" to the project board.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Project · shop/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /P1 · Deploy notes/ })).toBeDefined()
  await ui.unmount()

  expect(disk.get('project:/work/shop')).toBeDefined()
  expect(disk.get('session:s1')).toBeUndefined()
})

test('/pin says so when Claude has not replied yet', async ($, on) => {
  engine(on)
  on('session.messages', () => ({ value: [{ role: 'user', text: 'hi', toolUses: [] }] }))
  await $.session.start(START)

  expect((await run($, 'pin')).text).toBe('There is no reply from Claude to pin yet.')
})

test('/pins shows the pane', async ($, on) => {
  engine(on)
  await $.session.start(START)

  expect((await run($, 'pins')).text).toBe('Pinned pane shown.')
})

test('/unpin names a pin by label, and a bare number needs a single board', async ($, on) => {
  const { disk } = engine(on, {
    'session:s1': { pins: [pinOf('Tests', '- [x] Checkout', 2)], updatedAt: Date.now() },
    'project:/work/shop': { pins: [pinOf('Deploy', 'Run the script.', 1)], updatedAt: 1 },
  })
  await $.session.start(START)

  expect((await run($, 'unpin', '1')).text).toContain('use s1')
  expect((await run($, 'unpin', 'p9')).text).toContain('There is no pin p9')
  expect((await run($, 'unpin', 'p1')).text).toBe('Removed "Deploy".')
  expect(disk.get('project:/work/shop')).toBeUndefined()
  expect(disk.get('session:s1')).toBeDefined()
})

test('/unpin all clears both boards, and without an argument shows its usage', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('One', 'a'))
  await $.tool.call(pinCall('Two', 'b', 'project'))

  expect((await run($, 'unpin')).text).toContain('Usage: /unpin')
  expect((await run($, 'unpin', 'all')).text).toBe('Removed 2 pins.')
  expect(disk.size).toBe(0)
  expect((await run($, 'unpin', 'all')).text).toBe('Nothing is pinned.')
})

test('a command answers the error when the store cannot be written', async ($, on) => {
  const { disk, store } = engine(on)
  reply(on, 'A reply')
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', 'a'))
  const before = JSON.stringify([...disk])
  store.isBroken = true

  expect((await run($, 'pin', 'Other')).text).toContain('could not be saved')
  expect((await run($, 'unpin', 's1')).text).toContain('could not be saved')
  expect((await run($, 'unpin', 'all')).text).toContain('could not be saved')

  store.isBroken = false
  expect(JSON.stringify([...disk])).toBe(before)
  expect((await run($, 'unpin', 's1')).text).toBe('Removed "Tests".')
})

test('removing the last pin closes the pane, whichever way it goes', async ($, on) => {
  const { panesClosed } = engine(on)
  await $.session.start(START)

  await $.tool.call(pinCall('One', 'a'))
  await run($, 'unpin', 's1')
  expect(panesClosed()).toBe(1)

  await $.tool.call(pinCall('One', 'a'))
  await $.tool.call(pinCall('Two', 'b'))
  await run($, 'unpin', 's1')
  expect(panesClosed()).toBe(1)
  await run($, 'unpin', 'all')
  expect(panesClosed()).toBe(2)
})

test('/pin remembers the reply it pins once that reply was drawn, and none otherwise', async ($, on) => {
  const { disk } = engine(on)
  engineRow(on)
  reply(on, '# Deploy\n\nRun the release script.')
  await $.session.start(START)

  await run($, 'pin', 'Before')
  expect((disk.get('session:s1') as Saved).pins[0]?.source).toBeUndefined()

  const ui = await $.ui.mount({
    plugin: 'pinboard',
    surface: 'desktop',
    component: 'AssistantMessage',
    requestId: 'm-deploy',
    props: { text: '# Deploy\n\nRun the release script.', isFirstOfReply: true },
  })
  await ui.unmount()
  await run($, 'pin', 'After')

  const pins = (disk.get('session:s1') as Saved).pins
  expect(pins).toHaveLength(1)
  // The same text pinned again is the same pin, now with its source.
  expect(pins[0]?.title).toBe('Before')
  expect(pins[0]?.source).toBe('m-deploy')
})
