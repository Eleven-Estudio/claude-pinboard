import { expect, test } from 'claude-code/testing'

import { jumpTo, scrollArgs } from '../../hooks/lib/jump'
import { fakePorts } from '../fake-ports'

test('the jump puts the top of the source reply at the top of the view', async () => {
  expect(scrollArgs('m-1')).toEqual({ to: { requestId: 'm-1' }, block: 'start' })
})

test('a jump that lands says so, and one that does not says that too', async () => {
  const { ports, fake, scrolls } = fakePorts()

  expect(await jumpTo(ports, 'm-1')).toBe(true)
  expect(scrolls).toEqual([scrollArgs('m-1')])

  fake.scrollResult = { deny: 'not person-initiated' }
  expect(await jumpTo(ports, 'm-1')).toBe(false)

  ports.ui.scroll = async () => {
    throw new Error('no surface')
  }
  expect(await jumpTo(ports, 'm-1')).toBe(false)
})
