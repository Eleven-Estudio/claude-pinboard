// `- [ ] item`, `* [x] item`, `1. [ ] item`: a markdown task line.
export const CHECK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s+(.*)$/
const FENCE = /^\s*(```|~~~)/

export type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'check'; line: number; raw: string; text: string; isDone: boolean; indent: number }

// Splits a body into markdown runs and task lines. Task lines inside a code
// fence stay markdown.
export function segments(body: string): Segment[] {
  const out: Segment[] = []
  let buffer: string[] = []
  let isInFence = false
  const flush = () => {
    const text = buffer.join('\n')
    if (text.trim() !== '') out.push({ kind: 'markdown', text })
    buffer = []
  }

  body.split('\n').forEach((line, index) => {
    if (FENCE.test(line)) isInFence = !isInFence
    const match = isInFence ? null : CHECK.exec(line)
    if (match === null) {
      buffer.push(line)
      return
    }
    flush()
    const lead = match[1] ?? ''
    out.push({
      kind: 'check',
      line: index,
      raw: line,
      text: (match[3] ?? '').replace(/\*\*|__|`/g, ''),
      isDone: match[2] !== ' ',
      indent: lead.length - lead.trimStart().length,
    })
  })
  flush()

  return out
}

// Flips the box on one line of the body; any other line leaves it as it was.
export function toggleLine(body: string, index: number): string {
  const lines = body.split('\n')
  const match = CHECK.exec(lines[index] ?? '')
  if (match === null) return body
  lines[index] = `${match[1]}[${match[2] === ' ' ? 'x' : ' '}] ${match[3]}`

  return lines.join('\n')
}

// What names a task line whether or not it is ticked: its marker and text.
function taskKey(line: string): string | undefined {
  const match = CHECK.exec(line)

  return match === null ? undefined : `${match[1]}${match[3]}`
}

// Flips the box of the task line the person pressed. The body may have changed
// since it was drawn, so `raw` (that line as drawn) is checked: the line at
// `index` if it still is that task, else the first line that is, else none.
export function toggleTask(body: string, index: number, raw: string): string {
  const key = taskKey(raw)
  if (key === undefined) return body
  const lines = body.split('\n')
  if (taskKey(lines[index] ?? '') === key) return toggleLine(body, index)
  const found = lines.findIndex(line => taskKey(line) === key)

  return found === -1 ? body : toggleLine(body, found)
}

// `2/5` for a body with task lines, '' for one without.
export function progress(body: string): string {
  const checks = segments(body).filter(segment => segment.kind === 'check')
  if (checks.length === 0) return ''
  const done = checks.filter(segment => segment.kind === 'check' && segment.isDone).length

  return `${done}/${checks.length}`
}
