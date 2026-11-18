import { expect, test } from 'claude-code/testing'

import { resetReplies } from '../../hooks/lib/replies'
import { duration } from '../../hooks/views/turn-control'
import { START, type Saved, engine, engineRow } from '../support'

const message = (requestId: string, text: string) =>
  ({
    plugin: 'pinboard',
    surface: 'terminal',
    component: 'AssistantMessage',
    requestId,
    props: { text, isFirstOfReply: true },
  }) as const

const turnLine = (requestId: string, props: Record<string, unknown> = {}) =>
  ({
    plugin: 'pinboard',
    surface: 'terminal',
    component: 'TurnDuration',
    requestId,
    props: { word: 'Worked', durationMs: 12_000, ...props },
  }) as never

test('turn: the closing line pins the turn last block, and blocks get no hover control', { options: { pinControls: 'turn' } }, async ($, on) => {
  resetReplies()
  const { disk } = engine(on)
  engineRow(on)
  await $.session.start(START)

  const narration = await $.ui.mount(message('m-1', 'Reading the files first.'))
  expect(await narration.find({ key: 'pin:m-1' })).toBeUndefined()
  const answer = await $.ui.mount(message('m-2', '# Steps\n\n- [ ] Pay with the test card'))
  const line = await $.ui.mount(turnLine('t-1'))

  expect((await line.find({ type: 'Text', text: /Worked for 12s/ }))?.text).toContain('Worked for 12s')
  await line.press({ key: 'tpin:t-1' })
  await line.unmount()
  await narration.unmount()
  await answer.unmount()

  const saved = disk.get('session:s1') as Saved
  expect(saved.pins).toHaveLength(1)
  expect(saved.pins[0]?.title).toBe('Steps')
  expect(saved.pins[0]?.source).toBe('m-2')
})

test('turn: a line that says more is left as the engine draws it', { options: { pinControls: 'turn' } }, async ($, on) => {
  resetReplies()
  engine(on)
  engineRow(on)
  const answer = await $.ui.mount(message('m-3', 'An answer'))
  const line = await $.ui.mount(turnLine('t-2', { waitingFor: { agents: [], workflows: 1 } }))

  expect(await line.find({ key: 'tpin:t-2' })).toBeUndefined()
  expect((await line.find({ type: 'Text', text: /engine row/ }))?.text).toBe('engine row')
  await line.unmount()
  await answer.unmount()
})

test('hover, the default: the turn line is the engine one', async ($, on) => {
  resetReplies()
  engine(on)
  engineRow(on)
  const answer = await $.ui.mount(message('m-4', 'An answer'))
  const line = await $.ui.mount(turnLine('t-3'))

  expect(await line.find({ key: 'tpin:t-3' })).toBeUndefined()
  expect(await answer.find({ key: 'pin:m-4' })).toBeDefined()
  await line.unmount()
  await answer.unmount()
})

test('both: the hover control and the turn line', { options: { pinControls: 'both' } }, async ($, on) => {
  resetReplies()
  engine(on)
  engineRow(on)
  const answer = await $.ui.mount(message('m-5', 'An answer'))
  const line = await $.ui.mount(turnLine('t-4'))

  expect(await answer.find({ key: 'pin:m-5' })).toBeDefined()
  expect(await line.find({ key: 'tpinp:t-4' })).toBeDefined()
  await line.unmount()
  await answer.unmount()
})

test('the duration reads as the engine line does', async () => {
  expect(duration(3_000)).toBe('3s')
  expect(duration(64_000)).toBe('1m 4s')
  expect(duration(3_720_000)).toBe('1h 2m')
})
