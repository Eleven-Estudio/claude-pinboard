import { expect, test } from 'claude-code/testing'

import { findReplySource, rememberReply, replyOfLine, resetReplies } from '../../hooks/lib/replies'

test('the most recent instance with the same text is the source', async () => {
  resetReplies()
  rememberReply('a', 'Same text')
  rememberReply('b', 'Other')
  rememberReply('c', 'Same text')
  // Drawn again, an instance keeps its place.
  rememberReply('a', 'Same text')

  expect(findReplySource('  Same text ')).toBe('c')
  expect(findReplySource('Nothing like it')).toBeUndefined()
})

test('only the last 200 instances are kept', async () => {
  resetReplies()
  rememberReply('first', 'The oldest reply')
  for (let i = 0; i < 200; i++) rememberReply(`m${i}`, `Reply ${i}`)

  expect(findReplySource('The oldest reply')).toBeUndefined()
  expect(findReplySource('Reply 199')).toBe('m199')
})

test('a reply of several blocks is traced to its earliest block', async () => {
  resetReplies()
  rememberReply('late', 'The second block of the reply.')
  rememberReply('first', 'The first block of the reply.')
  rememberReply('tiny', 'Done.')
  const reply = 'The first block of the reply.\n\nThe second block of the reply.\n\nDone.'

  expect(findReplySource(reply)).toBe('first')
})

test('a short block matches only a reply that is exactly it', async () => {
  resetReplies()
  rememberReply('short', 'Done.')

  expect(findReplySource('Done.')).toBe('short')
  expect(findReplySource('Everything is fine. Done. Nothing else.')).toBeUndefined()
})

test('a turn line keeps the block drawn before it, even once newer blocks are drawn', async () => {
  resetReplies()
  expect(replyOfLine('line-0')).toBeUndefined()
  rememberReply('a1', 'Narration between tools')
  rememberReply('a2', 'The answer of the first turn')

  expect(replyOfLine('line-1')?.requestId).toBe('a2')

  rememberReply('b1', 'The answer of the second turn')
  expect(replyOfLine('line-1')?.requestId).toBe('a2')
  expect(replyOfLine('line-2')?.requestId).toBe('b1')
})

test('redrawing an old block does not make it the one a new turn line pins', async () => {
  resetReplies()
  rememberReply('a1', 'The answer of the first turn')
  rememberReply('b1', 'The answer of the second turn')
  rememberReply('a1', 'The answer of the first turn')

  expect(replyOfLine('line-2')?.requestId).toBe('b1')
})
