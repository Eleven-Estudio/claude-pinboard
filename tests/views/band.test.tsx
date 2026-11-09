import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

import { CHECKLIST, START, engine, engineRow, pinCall, pinOf } from '../support'

const BAND = {
  plugin: 'pinboard',
  component: 'AbovePrompt',
  requestId: 'band',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const press = async ($: Parameters<TestBody>[0], command: string) =>
  $.command.run({ command } as Parameters<typeof $.command.run>[0])

test('the band is left to the engine until the pane is minimized', async ($, on) => {
  engine(on)
  engineRow(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeDefined()
  expect(await ui.find({ key: 'restore' })).toBeUndefined()
  await ui.unmount()
})

test('minimized, the band is one line that brings the pane back when pressed', async ($, on) => {
  const { panes } = engine(on)
  engineRow(on)
  await $.session.start(START)
  await $.tool.call(pinCall('Tests', CHECKLIST))
  await press($, 'pins')
  expect(panes.has('pinboard')).toBe(false)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const band = await ui.find({ key: 'restore' })
    expect(band?.text).toBe('📌 1 pinned · S1 Tests 0/2')
    expect(await ui.find({ type: 'Text', text: /engine row/ })).toBeUndefined()
    await ui.unmount()
  }

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'restore' })
  await ui.unmount()
  expect(panes.has('pinboard')).toBe(true)

  const after = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await after.find({ key: 'restore' })).toBeUndefined()
  await after.unmount()
})

test('the band yields to a survey and to an empty board', async ($, on) => {
  engine(on, { 'session:s1': { pins: [pinOf('Tests', 'a')], updatedAt: Date.now() } })
  engineRow(on)
  await $.session.start(START)
  await press($, 'pins')

  const survey = await $.ui.mount({ ...BAND, surface: 'terminal', props: { ...BAND.props, hasSurvey: true } })
  expect(await survey.find({ key: 'restore' })).toBeUndefined()
  await survey.unmount()
})
