import { expect, test } from 'claude-code/testing'

import { findReplySource, rememberReply } from '../../hooks/lib/replies'

test('the most recent instance with the same text is the source', async () => {
  rememberReply('a', 'Same text')
  rememberReply('b', 'Other')
  rememberReply('c', 'Same text')
  // Drawn again, an instance keeps its place.
  rememberReply('a', 'Same text')

  expect(findReplySource('  Same text ')).toBe('c')
  expect(findReplySource('Nothing like it')).toBeUndefined()
})

test('only the last 200 instances are kept', async () => {
  rememberReply('first', 'The oldest reply')
  for (let i = 0; i < 200; i++) rememberReply(`m${i}`, `Reply ${i}`)

  expect(findReplySource('The oldest reply')).toBeUndefined()
  expect(findReplySource('Reply 199')).toBe('m199')
})
