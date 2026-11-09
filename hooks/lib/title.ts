import type { Pin } from '../../types'
import { CHECK } from './checklist'
import type { Ports } from './ports'

// A short title for a pin made from a reply is asked of a small model; the
// quick guess from titleFrom stays if it fails.
const TITLE_MODEL = 'haiku'
// How much of the note the model reads: enough to name it, bounded in cost.
const TITLE_BODY_CHARS = 6000
// A title is a few words; this stops a model that rambles.
const TITLE_MAX_TOKENS = 40
// Longer and the pin is on screen too long under its quick guess.
const TITLE_TIMEOUT_MS = 20_000
// A title longer than this is cut, with an ellipsis, to fit one pane line.
const TITLE_MAX_LENGTH = 48
const TITLE_PROMPT =
  'Write a title of 2 to 6 words for the note below, so its author can find it in a list of notes. Use the language the note is written in. Reply with the title alone: no quotes, no markdown, no final period.\n\n<note>\n'

// Markdown out of a one-line label: emphasis, code, links, a heading's
// hashes, a trailing colon or period.
export function cleanTitle(text: string): string {
  const line = (text.split('\n').find(one => one.trim() !== '') ?? '')
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`|^["'«“]|["'»”]$/g, '')
    .replace(/[:.]\s*$/, '')
    .trim()

  return line.length > TITLE_MAX_LENGTH ? `${line.slice(0, TITLE_MAX_LENGTH - 1)}…` : line
}

// The quick guess: the first heading, else a bold phrase opening a line,
// else the first line with words in it.
export function titleFrom(body: string): string {
  const lines = body.split('\n').map(line => line.trim())
  const heading = lines.find(line => /^#{1,6}\s+\S/.test(line))
  const bold = lines.map(line => /^\*\*(.+?)\*\*/.exec(line)?.[1]).find(Boolean)
  const first = lines.find(line => /\p{L}/u.test(line))

  return cleanTitle(heading ?? bold ?? first ?? '') || 'Note'
}

// The body as drawn in an open card: a first line that only repeats the
// title is blanked, never removed, so checkbox line numbers stay the body's.
export function bodyBelowTitle(pin: Pin): string {
  const lines = pin.body.split('\n')
  const index = lines.findIndex(line => line.trim() !== '')
  if (index === -1 || CHECK.test(lines[index] ?? '') || cleanTitle(lines[index] ?? '') !== pin.title) {
    return pin.body
  }
  lines[index] = ''

  return lines.join('\n')
}

// Asks the small model for a title; '' when it does not answer.
export async function requestTitle(ports: Ports, body: string): Promise<string> {
  const text = await ports.model.complete({
    model: TITLE_MODEL,
    prompt: `${TITLE_PROMPT}${body.slice(0, TITLE_BODY_CHARS)}\n</note>`,
    maxTokens: TITLE_MAX_TOKENS,
    effort: 'low',
    timeoutMs: TITLE_TIMEOUT_MS,
  })

  return cleanTitle(text)
}
