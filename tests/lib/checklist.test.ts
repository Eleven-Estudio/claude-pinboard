import { expect, test } from 'claude-code/testing'

import { progress, segments, toggleLine, toggleTask } from '../../hooks/lib/checklist'

test('task lines become check segments between markdown runs', async () => {
  const body = '## Login\n\n- [ ] Log in\n  * [x] **Bold** `code`\n1. [ ] Third\n\nDone.'
  const parts = segments(body)

  expect(parts.map(part => part.kind)).toEqual(['markdown', 'check', 'check', 'check', 'markdown'])
  expect(parts[2]).toEqual({
    kind: 'check',
    line: 3,
    raw: '  * [x] **Bold** `code`',
    text: 'Bold code',
    isDone: true,
    indent: 2,
  })
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

test('a press toggles the line it was drawn from, even after the body moved', async () => {
  const drawn = '- [ ] Pay'
  const body = '- [ ] Log in\n- [ ] Pay'

  expect(toggleTask(body, 1, drawn)).toBe('- [ ] Log in\n- [x] Pay')

  // Lines were added above: the same task is found where it moved to.
  const moved = '- [ ] New\n- [ ] Other\n- [ ] Log in\n- [ ] Pay'
  expect(toggleTask(moved, 1, drawn)).toBe('- [ ] New\n- [ ] Other\n- [ ] Log in\n- [x] Pay')

  // The task is gone, or a different one took its place: nothing is toggled.
  expect(toggleTask('- [ ] Log in', 1, drawn)).toBe('- [ ] Log in')
  expect(toggleTask('- [ ] Log in\n- [ ] Refund', 1, drawn)).toBe('- [ ] Log in\n- [ ] Refund')
})
