import { expect, test } from 'claude-code/testing'

import { CHECKLIST, PANE, START, type Saved, engine, LIST_CALL, pinCall, pinOf } from '../support'

test('a checklist the model pins opens as a card that can be ticked off, and is saved', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))

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

  const listed = await $.tool.call(LIST_CALL)
  expect(String(listed.result)).toContain('- [x] Log in with a test account')
  expect(String(listed.result)).toContain('- [ ] Log out')
  expect((disk.get('session:s1') as Saved).pins[0]?.body).toContain('- [x] Log in with a test account')
})

test('the card header shows the progress', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', '- [x] One\n- [ ] Two'))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /1\/2/ })).toBeDefined()
  await ui.unmount()
})

test('one card is open at a time: the newest, until another is picked', async ($, on) => {
  engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Login', '- [ ] Log in'))
  await $.tool.call(pinCall('Checkout', '- [ ] Pay'))

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

test('the x on a card removes the pin', async ($, on) => {
  const { disk } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', 'a'))

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const remove = await ui.find({ type: 'Button', text: /x/ })
  await ui.press({ key: remove?.key ?? '' })
  await ui.unmount()

  expect(disk.get('session:s1')).toBeUndefined()
})

test('an empty board says how to pin', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('Nothing pinned.')
  await ui.unmount()
})

test('a press that cannot be saved shows why and leaves the card as it was', async ($, on) => {
  const { toasts, store } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))
  store.isBroken = true

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const login = await ui.find({ type: 'Button', text: /\[ \] Log in/ })
  await ui.press({ key: login?.key ?? '' })

  expect(toasts.join(' ')).toContain('could not be saved')
  expect(await ui.find({ type: 'Button', text: /\[ \] Log in/ })).toBeDefined()
  await ui.unmount()
})

test('the arrow tells the person when the reply cannot be reached', async ($, on) => {
  // The test engine has no transcript to scroll, so the jump cannot land.
  const { toasts } = engine(on, {
    'session:s1': {
      pins: [{ ...pinOf('Tests', 'a', 2), source: 'toolu_7' }, pinOf('Plain', 'b', 1)],
      updatedAt: Date.now(),
    },
  })
  await $.session.start(START)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  // Only the pin that has a source gets an arrow.
  const arrows = await ui.findAll({ type: 'Button', text: /↑/ })
  expect(arrows).toHaveLength(1)
  await ui.press({ key: arrows[0]?.key ?? '' })
  expect(toasts).toEqual(['That reply is no longer in the view.'])
  await ui.unmount()
})

test('the dash folds the pane to the band', async ($, on) => {
  const { panes } = engine(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', 'a'))
  expect(panes.has('pinboard')).toBe(true)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'minimize' })
  await ui.unmount()
  expect(panes.has('pinboard')).toBe(false)

  // Minimized: a new pin says so with a toast and leaves the pane closed.
  await $.tool.call(pinCall('More', 'b'))
  expect(panes.has('pinboard')).toBe(false)
})
