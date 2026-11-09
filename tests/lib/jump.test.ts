import { expect, test } from 'claude-code/testing'

import { scrollArgs } from '../../hooks/lib/jump'

test('the jump puts the top of the source reply at the top of the view', async () => {
  expect(scrollArgs('m-1')).toEqual({ to: { requestId: 'm-1' }, block: 'start' })
})
