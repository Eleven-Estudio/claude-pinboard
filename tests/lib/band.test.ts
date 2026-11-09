import { expect, test } from 'claude-code/testing'

import { bandText } from '../../hooks/lib/band'

const pin = (id: string, title: string, scope: 'session' | 'project', pinnedAt: number, body = 'text') =>
  ({ id, title, body, scope, pinnedAt }) as const

const list = [
  pin('a', 'Discount Code Checklist', 'session', 1, '- [x] a\n- [x] b\n- [ ] c'),
  pin('b', 'Deploy', 'project', 2),
]

test('the band names the count and the open pin with its progress', async () => {
  expect(bandText(list, 'a', 80)).toBe('📌 2 pinned · S1 Discount Code Checklist 2/3')
})

test('the band names the newest pin when none is open', async () => {
  expect(bandText(list, null, 80)).toBe('📌 2 pinned · P1 Deploy')
  expect(bandText(list, '', 80)).toBe('📌 2 pinned · P1 Deploy')
})

test('a long title is cut to fit and the progress stays', async () => {
  const text = bandText(list, 'a', 36)

  expect(text.length).toBeLessThanOrEqual(36 - 2)
  expect(text).toContain('…')
  expect(text.endsWith(' 2/3')).toBe(true)
})

test('nothing pinned gives no line', async () => {
  expect(bandText([], null, 80)).toBe('')
})
