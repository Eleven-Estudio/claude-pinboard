import { expect, test } from 'claude-code/testing'

import { progress, segments, toggleLine } from '../../hooks/lib/checklist'

test('task lines become check segments between markdown runs', async () => {
  const body = '## Login\n\n- [ ] Log in\n  * [x] **Bold** `code`\n1. [ ] Third\n\nDone.'
  const parts = segments(body)

  expect(parts.map(part => part.kind)).toEqual(['markdown', 'check', 'check', 'check', 'markdown'])
  expect(parts[2]).toEqual({ kind: 'check', line: 3, text: 'Bold code', isDone: true, indent: 2 })
})

test('a task line inside a code fence stays markdown', async () => {
  const parts = segments('```\n- [ ] not a task\n```\n- [ ] a task')

  expect(parts.filter(part => part.kind === 'check')).toHaveLength(1)
})

test('toggling flips one box and leaves other lines alone', async () => {
  const body = '- [ ] one\n- [x] two\nplain'

  expect(toggleLine(body, 0)).toBe('- [x] one\n- [x] two\nplain')
  expect(toggleLine(body, 1)).toBe('- [ ] one\n- [ ] two\nplain')
  expect(toggleLine(body, 2)).toBe(body)
  expect(toggleLine(body, 9)).toBe(body)
})

test('progress counts ticked boxes, and is empty without any', async () => {
  expect(progress('- [x] a\n- [ ] b\n- [x] c')).toBe('2/3')
  expect(progress('just a note')).toBe('')
})
