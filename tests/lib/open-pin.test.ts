import { expect, test } from 'claude-code/testing'

import { resolveOpenId } from '../../hooks/lib/open-pin'

const pin = (id: string, pinnedAt: number) =>
  ({ id, title: id, body: '', scope: 'session', pinnedAt }) as const
const list = [pin('old', 1), pin('new', 2)]

test('an empty pick means every card is closed', async () => {
  expect(resolveOpenId('', list)).toBe('')
})

test('a pick that still exists stays open', async () => {
  expect(resolveOpenId('old', list)).toBe('old')
})

test('no pick, or a pick that is gone, opens the newest pin', async () => {
  expect(resolveOpenId(null, list)).toBe('new')
  expect(resolveOpenId('gone', list)).toBe('new')
  expect(resolveOpenId(null, [])).toBe('')
})
