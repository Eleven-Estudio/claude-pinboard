import { expect, test } from 'claude-code/testing'

import { foldsOnClose } from '../../hooks/lib/close'

test('only the person closing a pane that has pins folds it', async () => {
  expect(foldsOnClose('person', 2)).toBe(true)
  expect(foldsOnClose('person', 0)).toBe(false)
  expect(foldsOnClose('plugin', 2)).toBe(false)
  expect(foldsOnClose('unload', 2)).toBe(false)
})
