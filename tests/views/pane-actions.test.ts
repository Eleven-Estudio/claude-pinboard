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
