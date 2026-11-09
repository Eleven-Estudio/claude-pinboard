// `- [ ] item`, `* [x] item`, `1. [ ] item`: a markdown task line.
export const CHECK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s+(.*)$/
const FENCE = /^\s*(```|~~~)/

export type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'check'; line: number; text: string; isDone: boolean; indent: number }

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

// `2/5` for a body with task lines, '' for one without.
export function progress(body: string): string {
  const checks = segments(body).filter(segment => segment.kind === 'check')
  if (checks.length === 0) return ''
  const done = checks.filter(segment => segment.kind === 'check' && segment.isDone).length

  return `${done}/${checks.length}`
}
