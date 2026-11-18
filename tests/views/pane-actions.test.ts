import { expect, test } from 'claude-code/testing'

import { paneActions } from '../../hooks/views/pane'
import { fakePorts } from '../fake-ports'

const pin = { id: 'a', title: 'Tests', body: 'x', scope: 'session', pinnedAt: 1, source: 'm-1' } as const

test('a jump that lands shows no message, and one that does not says so', async () => {
  const { ports, fake, toasts } = fakePorts()
  const actions = paneActions(ports)

  await actions.jump('m-1')
  expect(toasts).toEqual([])

  fake.scrollResult = { deny: 'not person-initiated' }
  await actions.jump('m-1')
  expect(toasts).toEqual(['That reply is no longer in the view.'])
})

test('a press that cannot close the pane says why', async () => {
  const { ports, fake, toasts } = fakePorts()
  fake.isCloseBroken = true

  await paneActions(ports).minimize()
  expect(toasts).toEqual(['no surface'])
  expect(fake.isMinimized).toBe(false)
})

test('the card header opens a closed card and closes an open one', async () => {
  const { ports, fake } = fakePorts()
  const actions = paneActions(ports)

  await actions.toggleOpen(pin, false)
  expect(fake.openPin).toBe('a')
  await actions.toggleOpen(pin, true)
  expect(fake.openPin).toBe('')
})

test('many: the header selects the card and folds or unfolds only that one', async () => {
  const { ports, fake } = fakePorts({ openCards: 'many' })
  const other = { ...pin, id: 'b', pinnedAt: 2 }
  fake.pins = [pin, other]
  const actions = paneActions(ports)

  // Nothing chosen yet: the newest, b, is the open card.
  await actions.toggleOpen(pin, false)
  expect(fake.openPin).toBe('a')
  expect(fake.expandedPins).toEqual(['b', 'a'])
  await actions.toggleOpen(other, true)
  expect(fake.openPin).toBe('b')
  expect(fake.expandedPins).toEqual(['a'])
})

test('one: the header never writes the unfolded cards', async () => {
  const { ports, fake } = fakePorts()
  await paneActions(ports).toggleOpen(pin, false)
  expect(fake.expandedPins).toBeNull()
})
