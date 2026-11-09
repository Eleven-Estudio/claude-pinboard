import { expect, test } from 'claude-code/testing'

import { jumpTo, scrollArgs } from '../../hooks/lib/jump'

test('the jump puts the top of the source reply at the top of the view', async () => {
  expect(scrollArgs('m-1')).toEqual({ to: { requestId: 'm-1' }, block: 'start' })
})

test('a jump that lands says so, and one that does not says that too', async () => {
  const asked: unknown[] = []
  const lands = async (args: unknown) => (asked.push(args), {})

  expect(await jumpTo(lands, 'm-1')).toBe(true)
  expect(asked).toEqual([scrollArgs('m-1')])
  expect(await jumpTo(async () => ({ deny: 'not person-initiated' }), 'm-1')).toBe(false)
  expect(
    await jumpTo(async () => {
      throw new Error('no surface')
    }, 'm-1'),
  ).toBe(false)
})
