import { expect, test } from 'claude-code/testing'

import { bodyBelowTitle, cleanTitle, titleFrom } from '../../hooks/lib/title'

test('titles come from a heading, a bold opener, or the first line', async () => {
  expect(titleFrom('Intro line.\n\n## Where to publish\n\nText')).toBe('Where to publish')
  expect(titleFrom('**Is there anything similar?** Not on the site.')).toBe('Is there anything similar?')
  expect(titleFrom('\n\nFound the following.\n\nMore')).toBe('Found the following')
  expect(titleFrom('')).toBe('Note')
})

test('a title loses markdown, quotes and a trailing period, and is cut at 48 characters', async () => {
  expect(cleanTitle('## **Deploy** [guide](https://example.com).')).toBe('Deploy guide')
  expect(cleanTitle('"Checkout test plan."')).toBe('Checkout test plan')
  expect(cleanTitle('x'.repeat(60))).toBe(`${'x'.repeat(47)}…`)
})

test('a first line that only repeats the title is blanked, keeping line numbers', async () => {
  const pin = { id: 'a', title: 'Steps', body: '# Steps\n- [ ] Pay', scope: 'session', pinnedAt: 1 } as const

  expect(bodyBelowTitle(pin)).toBe('\n- [ ] Pay')
  expect(bodyBelowTitle({ ...pin, title: 'Other' })).toBe(pin.body)
  expect(bodyBelowTitle({ ...pin, title: 'Log in', body: '- [ ] Log in' })).toBe('- [ ] Log in')
})
