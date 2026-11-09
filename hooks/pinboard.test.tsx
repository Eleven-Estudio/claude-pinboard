import { expect, mock, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { bodyBelowTitle, titleFrom } from './lib/title'

const PANE = {
  plugin: 'pinboard',
  component: 'Pane',
  requestId: 'pinboard',
  props: {
    title: 'Pinned',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const CHECKLIST = '## Login\n\n- [ ] Log in with a test account\n- [ ] Log out'
const START = { cwd: '/work/shop', surface: 'desktop', isInteractive: true } as const
const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

// Nothing sits beneath the plugin: these hooks stand for the engine. The
// plugin's store is a Map the test reads back, standing for the file on disk.
function engine(on: Parameters<TestBody>[1], stored: Record<string, unknown> = {}) {
  const disk = new Map<string, unknown>(Object.entries(stored))
  on('store.get', (_, e) => ({ value: disk.get(e.key) }))
  on('store.set', (_, e) => (disk.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_, e) => (disk.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...disk.keys()] }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pinboard__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: '/work/shop' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  return disk
}

// Stands for the engine drawing a reply block itself.
function engineRow(on: Parameters<TestBody>[1]) {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine row</Text>
  })
}

function pinOf(title: string, body: string, pinnedAt = 1) {
  return { id: title, title, body, pinnedAt }
}

type Saved = { pins: { title: string; body: string }[] }

test('a checklist the model pins opens as a card that can be ticked off, and is saved', async ($, on) => {
  const disk = engine(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'mcp__pinboard__pin', title: 'Tests', markdown: CHECKLIST })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /S1 · Tests/ }))?.text).toContain('S1 · Tests')
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const login = await ui.find({ type: 'Button', text: /\[ \] Log in/ })
  expect(login?.key).toBeDefined()
  await ui.press({ key: login?.key ?? '' })
  expect((await ui.find({ type: 'Button', text: /Log in/ }))?.text).toContain('[x] Log in')
  await ui.unmount()

  const listed = await $.tool.call({ tool: 'mcp__pinboard__list_pins' })
  expect(String(listed.result)).toContain('- [x] Log in with a test account')
  expect(String(listed.result)).toContain('- [ ] Log out')
  expect((disk.get('session:s1') as Saved).pins[0]?.body).toContain('- [x] Log in with a test account')
})

test('one card is open at a time: the newest, until another is picked', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await $.tool.call({ tool: 'mcp__pinboard__pin', title: 'Login', markdown: '- [ ] Log in' })
  await $.tool.call({ tool: 'mcp__pinboard__pin', title: 'Checkout', markdown: '- [ ] Pay' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', text: /\[ \] Pay/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /\[ \] Log in/ })).toBeUndefined()

  const login = await ui.find({ type: 'Button', text: /S1 · Login/ })
  await ui.press({ key: login?.key ?? '' })
  expect(await ui.find({ type: 'Button', text: /\[ \] Log in/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /\[ \] Pay/ })).toBeUndefined()

  // Pressing the open card's header closes it.
  await ui.press({ key: login?.key ?? '' })
  expect(await ui.find({ type: 'Button', text: /\[ \] Log in/ })).toBeUndefined()
  await ui.unmount()
})

test('/pin project keeps the reply on the project board', async ($, on) => {
  const disk = engine(on)
  on('session.messages', () => ({
    value: [
      { role: 'user', text: 'how do I deploy?', toolUses: [] },
      { role: 'assistant', text: '# Deploy\n\nRun the release script.', toolUses: [] },
    ],
  }))
  await $.session.start(START)

  const ran = await $.command.run({ command: 'pin', args: 'project Deploy notes' } as Parameters<
    typeof $.command.run
  >[0])
  expect(ran.text).toBe('Pinned "Deploy notes" to the project board.')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Project · shop/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /P1 · Deploy notes/ })).toBeDefined()
  await ui.unmount()

  expect(disk.get('project:/work/shop')).toBeDefined()
  expect(disk.get('session:s1')).toBeUndefined()
})

test('a reply pinned without a title gets the small model title', async ($, on) => {
  const disk = engine(on)
  const clock = mock.clock(on)
  on('session.messages', () => ({
    value: [{ role: 'assistant', text: 'Here is what to try.\n\n- [ ] Pay with the test card', toolUses: [] }],
  }))
  on('model.complete', () => ({ value: { isAnswered: true, text: '"Checkout test plan."', usage: USAGE } }))
  await $.session.start(START)

  const ran = await $.command.run({ command: 'pin' } as Parameters<typeof $.command.run>[0])
  expect(ran.text).toBe('Pinned "Here is what to try" to the session board.')

  await clock.advance(1)
  expect((disk.get('session:s1') as Saved).pins[0]?.title).toBe('Checkout test plan')
})

test('both boards come back from disk when the session starts again', async ($, on) => {
  const disk = engine(on, {
    'session:s1': { pins: [pinOf('Tests', '- [x] Checkout', 2)], updatedAt: Date.now() },
    'project:/work/shop': { pins: [pinOf('Deploy', 'Run the script.', 1)], updatedAt: 1 },
  })
  await $.session.start(START)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /S1 · Tests/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /\[x\] Checkout/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /P1 · Deploy/ })).toBeDefined()
  await ui.unmount()

  // A bare number is ambiguous with pins on both boards.
  const unpin = (args: string) =>
    $.command.run({ command: 'unpin', args } as Parameters<typeof $.command.run>[0])
  expect((await unpin('1')).text).toContain('use s1')
  expect((await unpin('p1')).text).toBe('Removed "Deploy".')
  expect(disk.get('project:/work/shop')).toBeUndefined()
})

test('a session board untouched for months is dropped at start', async ($, on) => {
  const disk = engine(on, {
    'session:old': { pins: [pinOf('Old', 'stale')], updatedAt: 0 },
    'session:recent': { pins: [pinOf('Recent', 'fresh')], updatedAt: Date.now() },
  })
  await $.session.start(START)

  expect(disk.get('session:old')).toBeUndefined()
  expect(disk.get('session:recent')).toBeDefined()
})

test('the hover control under a reply block keeps the block and pins it once', async ($, on) => {
  const disk = engine(on)
  engineRow(on)
  await $.session.start(START)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'pinboard',
      surface,
      component: 'AssistantMessage',
      requestId: `m-${surface}`,
      props: { text: '# Steps\n\n- [ ] Pay with the test card', isFirstOfReply: true },
    })
    expect((await ui.find({ type: 'Text', text: /engine row/ }))?.text).toBe('engine row')
    expect(await ui.find({ key: `pinp:m-${surface}` })).toBeDefined()
    // The same block pinned twice stays one pin.
    await ui.press({ key: `pin:m-${surface}` })
    await ui.unmount()
  }

  const saved = disk.get('session:s1') as Saved
  expect(saved.pins).toHaveLength(1)
  expect(saved.pins[0]?.title).toBe('Steps')
})

test('a summary block is left as the engine draws it', async ($, on) => {
  engine(on)
  engineRow(on)
  const ui = await $.ui.mount({
    plugin: 'pinboard',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId: 'm-summary',
    props: { text: 'Read 3 files', isFirstOfReply: false, isSummary: true },
  })
  expect(await ui.find({ key: 'pin:m-summary' })).toBeUndefined()
  await ui.unmount()
})

test('titles come from a heading, a bold opener, or the first line', async () => {
  expect(titleFrom('Intro line.\n\n## Where to publish\n\nText')).toBe('Where to publish')
  expect(titleFrom('**Is there anything similar?** Not on the site.')).toBe('Is there anything similar?')
  expect(titleFrom('\n\nFound the following.\n\nMore')).toBe('Found the following')

  // A first line that only repeats the title is blanked, keeping line numbers.
  const pin = { id: 'a', title: 'Steps', body: '# Steps\n- [ ] Pay', scope: 'session', pinnedAt: 1 } as const
  expect(bodyBelowTitle(pin)).toBe('\n- [ ] Pay')
})

test('an empty board says how to pin', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('Nothing pinned.')
  await ui.unmount()
})
