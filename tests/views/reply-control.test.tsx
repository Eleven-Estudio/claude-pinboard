import { expect, test } from 'claude-code/testing'

import { START, type Saved, engine, engineRow } from '../support'

type Props = { text: string; isFirstOfReply: boolean; isSummary?: true }

const message = (surface: 'terminal' | 'desktop', requestId: string, props: Props) =>
  ({ plugin: 'pinboard', surface, component: 'AssistantMessage', requestId, props }) as const

test('the hover control under a reply block keeps the block and pins it once', async ($, on) => {
  const { disk } = engine(on)
  engineRow(on)
  await $.session.start(START)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount(
      message(surface, `m-${surface}`, { text: '# Steps\n\n- [ ] Pay with the test card', isFirstOfReply: true }),
    )
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

test('pin project puts the block on the project board and says so', async ($, on) => {
  const { disk, toasts } = engine(on)
  engineRow(on)
  await $.session.start(START)

  const ui = await $.ui.mount(message('desktop', 'm-1', { text: '# Deploy\n\nRun it.', isFirstOfReply: true }))
  await ui.press({ key: 'pinp:m-1' })
  await ui.unmount()

  expect(disk.get('project:/work/shop')).toBeDefined()
  expect(toasts).toContain('Pinned "Deploy" to the project board.')
})

test('a summary block is left as the engine draws it', async ($, on) => {
  engine(on)
  engineRow(on)
  const ui = await $.ui.mount(message('terminal', 'm-summary', { text: 'Read 3 files', isFirstOfReply: false, isSummary: true }))
  expect(await ui.find({ key: 'pin:m-summary' })).toBeUndefined()
  await ui.unmount()
})

test('a press that cannot be saved shows why', async ($, on) => {
  const { toasts, store } = engine(on)
  engineRow(on)
  await $.session.start(START)
  store.isBroken = true

  const ui = await $.ui.mount(message('desktop', 'm-2', { text: 'A note', isFirstOfReply: true }))
  await ui.press({ key: 'pin:m-2' })
  await ui.unmount()

  expect(toasts.join(' ')).toContain('could not be saved')
})
