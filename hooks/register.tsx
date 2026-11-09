import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Pin, PinScope } from '../types'

const PANE = 'pinboard'
const TITLE = 'Pinned'
const TOOL_PIN = 'mcp__pinboard__pin'
const TOOL_UNPIN = 'mcp__pinboard__unpin'
const TOOL_LIST = 'mcp__pinboard__list_pins'
// Session boards nobody touched in this long are dropped from the store at
// start, so it never fills up. Project boards are kept until unpinned.
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000

// Change the tag when Pin's fields change: an earlier version's value
// outlives a reload and is then read as empty instead of misread.
const pins = atom({ plugin: 'pinboard', key: 'pins' } as const, [], {
  shape: 'pins-2',
})
const openPin = atom({ plugin: 'pinboard', key: 'openPin' } as const, null)

// A short title for a pin made from a reply, asked of a small model after
// the pin is shown under a quick guess; the guess stays if it fails.
const TITLE_MODEL = 'haiku'
const TITLE_PROMPT =
  'Write a title of 2 to 6 words for the note below, so its author can find it in a list of notes. Use the language the note is written in. Reply with the title alone: no quotes, no markdown, no final period.\n\n<note>\n'

type Saved = { pins: Pin[]; updatedAt: number }

// The store keys the pins in $.state were loaded from. A module variable on
// purpose: a reload resets it, and the next sync reads the store again,
// which holds every write.
let loaded = { session: '', project: '' }

// `- [ ] item`, `* [x] item`, `1. [ ] item`: a markdown task line.
const CHECK = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\]\s+(.*)$/
const FENCE = /^\s*(```|~~~)/

type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'check'; line: number; text: string; isDone: boolean; indent: number }

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

export function toggleLine(body: string, index: number): string {
  const lines = body.split('\n')
  const match = CHECK.exec(lines[index] ?? '')
  if (match === null) return body
  lines[index] = `${match[1]}[${match[2] === ' ' ? 'x' : ' '}] ${match[3]}`

  return lines.join('\n')
}

function progress(body: string): string {
  const checks = segments(body).filter(s => s.kind === 'check')
  if (checks.length === 0) return ''
  const done = checks.filter(s => s.kind === 'check' && s.isDone).length

  return `${done}/${checks.length}`
}

// Markdown out of a one-line label: emphasis, code, links, a heading's
// hashes, a trailing colon or period.
export function cleanTitle(text: string): string {
  const line = (text.split('\n').find(one => one.trim() !== '') ?? '')
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`|^["'«“]|["'»”]$/g, '')
    .replace(/[:.]\s*$/, '')
    .trim()

  return line.length > 48 ? `${line.slice(0, 47)}…` : line
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

function newId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
}

function byScope(list: readonly Pin[], scope: PinScope): Pin[] {
  return list.filter(pin => pin.scope === scope)
}

function label(scope: PinScope, index: number): string {
  return `${scope === 'session' ? 'S' : 'P'}${index + 1}`
}

// `s2` / `p1` name a pin; a bare `2` does when only one board has pins.
function findByLabel(list: readonly Pin[], arg: string): Pin | 'ambiguous' | undefined {
  const match = /^([sp])?(\d+)$/i.exec(arg)
  if (match === null) return undefined
  const index = Number(match[2]) - 1
  const prefix = match[1]?.toLowerCase()
  const session = byScope(list, 'session')
  const project = byScope(list, 'project')
  if (prefix === 's') return session[index]
  if (prefix === 'p') return project[index]
  if (project.length === 0) return session[index]
  if (session.length === 0) return project[index]

  return 'ambiguous'
}

// `/pin project Deploy notes` → scope project, rest "Deploy notes".
function parseScoped(args: string): { scope: PinScope | undefined; rest: string } {
  const [first = '', ...rest] = args.trim().split(/\s+/)
  const word = first.toLowerCase()
  if (word === 'session' || word === 'project') return { scope: word, rest: rest.join(' ') }

  return { scope: undefined, rest: args.trim() }
}

const sessionKey = (id: string) => `session:${id}`
const projectKey = (root: string) => `project:${root}`

function isPin(value: unknown): value is Pin {
  if (typeof value !== 'object' || value === null) return false
  const pin = value as Record<string, unknown>

  return typeof pin.id === 'string' && typeof pin.title === 'string' && typeof pin.body === 'string'
}

function savedField(saved: unknown, field: keyof Saved): unknown {
  return typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>)[field] : undefined
}

async function loadSaved($: EngineInterface, key: string, scope: PinScope): Promise<Pin[]> {
  const list = savedField(await $.store.get(key), 'pins')

  return Array.isArray(list) ? list.filter(isPin).map(pin => ({ ...pin, scope })) : []
}

async function save($: EngineInterface, key: string, list: Pin[]): Promise<void> {
  if (list.length === 0) {
    await $.store.delete(key)
    return
  }
  const saved: Saved = { pins: list, updatedAt: Date.now() }
  await $.store.set(key, saved)
}

async function openPane($: EngineInterface): Promise<boolean> {
  const opened = await $.ui.open({ id: PANE, title: TITLE })

  return opened.isPlaced
}

// Loads the boards of the session and project in force when they are not
// the ones in $.state: at start, after a /clear or /resume, after a reload.
async function sync($: EngineInterface): Promise<void> {
  const [id, root] = await Promise.all([$.session.id(), $.session.root()])
  if (loaded.session === id && loaded.project === root) return
  const [sessionPins, projectPins] = await Promise.all([
    loadSaved($, sessionKey(id), 'session'),
    loadSaved($, projectKey(root), 'project'),
  ])
  loaded = { session: id, project: root }
  await update($, pins, () => [...sessionPins, ...projectPins])

  if (sessionPins.length + projectPins.length > 0) {
    const isUp = (await $.ui.panes()).some(pane => pane.id === PANE)
    if (!isUp) void openPane($)
  }
}

async function persist($: EngineInterface): Promise<void> {
  const list = await read($, pins)
  await Promise.all([
    save($, sessionKey(loaded.session), byScope(list, 'session')),
    save($, projectKey(loaded.project), byScope(list, 'project')),
  ])
}

// Every change goes through here: the right boards loaded, the change made,
// both boards written to disk.
async function mutate($: EngineInterface, change: (list: readonly Pin[]) => Pin[]): Promise<void> {
  await sync($)
  await update($, pins, list => change(list))
  await persist($)
}

type PinRequest = {
  scope: PinScope
  body: string
  // Given by the person or the model; absent, a guess now and the small
  // model's title once it answers.
  title?: string
}

async function addPin($: EngineInterface, request: PinRequest): Promise<{ title: string; isPlaced: boolean }> {
  const { scope, body } = request
  const title = request.title ?? titleFrom(body)
  let openId = ''
  let isNew = false

  await mutate($, list => {
    // The same text pinned again on a board just opens its card; the same
    // title replaces that pin's text.
    const same =
      list.find(pin => pin.scope === scope && pin.body === body) ??
      list.find(pin => pin.scope === scope && pin.title === title)
    if (same !== undefined) {
      openId = same.id
      return list.map(pin => (pin.id === same.id ? { ...pin, body } : pin))
    }
    openId = newId()
    isNew = true

    return [...list, { id: openId, title, body, scope, pinnedAt: Date.now() }]
  })
  await update($, openPin, () => openId)
  if (isNew && request.title === undefined) suggestTitle($, openId, title, body)

  return { title, isPlaced: await openPane($) }
}

// Off the caller's dispatch, on a timer: the pin shows at once, and its
// title changes when the model answers, unless the person renamed it.
function suggestTitle($: EngineInterface, id: string, guess: string, body: string): void {
  try {
    $.clock.after(0, () => {
      void (async () => {
        const reply = await $.model.complete({
          model: TITLE_MODEL,
          prompt: `${TITLE_PROMPT}${body.slice(0, 6000)}\n</note>`,
          maxTokens: 40,
          effort: 'low',
          timeoutMs: 20000,
        })
        const title = reply.isAnswered ? cleanTitle(reply.text) : ''
        if (title === '' || title === guess) return
        await mutate($, list =>
          list.map(pin => (pin.id === id && pin.title === guess ? { ...pin, title } : pin)),
        )
      })().catch(() => {
        // The guess stays.
      })
    })
  } catch {
    // No timer here: the guess stays.
  }
}

async function pruneStaleSessions($: EngineInterface, currentId: string): Promise<void> {
  const cutoff = Date.now() - SESSION_TTL_MS
  for (const key of await $.store.keys()) {
    if (!key.startsWith('session:') || key === sessionKey(currentId)) continue
    const updatedAt = savedField(await $.store.get(key), 'updatedAt')
    if (typeof updatedAt !== 'number' || updatedAt < cutoff) await $.store.delete(key)
  }
}

function lastReply(messages: readonly { role: string; text: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.role === 'assistant' && message.text.trim() !== '') {
      return message.text.trim()
    }
  }

  return ''
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asScope(value: unknown): PinScope | undefined {
  return value === 'session' || value === 'project' ? value : undefined
}

function plural(count: number): string {
  return `${count} pin${count === 1 ? '' : 's'}`
}

const WAITING =
  ' The pane is waiting for a wider terminal; the person can run /pins to show it.'
const UNPIN_USAGE = 'Usage: /unpin s1 | p2 | session | project | all'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'pin',
      description: "Pin Claude's last reply to this session's board, or the project's",
      argumentHint: '[session|project] [title]',
      immediate: true,
    })
    await $.command.register({
      name: 'pins',
      description: 'Show the pinned notes pane',
      immediate: true,
    })
    await $.command.register({
      name: 'unpin',
      description: 'Remove a pin (s1, p2) or a whole board (session, project, all)',
      argumentHint: 's1 | p2 | session | project | all',
      immediate: true,
    })

    await $.tool.register({
      name: 'pin',
      description:
        "Pin a note or checklist to the person's side pane, where it stays visible while the conversation moves on (it is not part of the transcript) and is kept on disk. Use it when the person asks to pin, keep or save something for later, such as the steps they must test. Write checklist items as markdown task lines ('- [ ] step') so the person can tick them off in the pane. Pinning again with the same title on the same board replaces that pin.",
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short heading for the pin' },
          markdown: { type: 'string', description: 'The pinned content, as markdown' },
          scope: {
            type: 'string',
            enum: ['session', 'project'],
            description:
              "'session' (default): this conversation's board, back whenever it is resumed. 'project': shown in every session in this project until unpinned; only when the person asks to keep it for the project.",
          },
        },
        required: ['title', 'markdown'],
      },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'list_pins',
      description:
        "Read what is pinned in the person's side pane, on the session's board and the project's, with which checklist items they have ticked ([x]) and which are still open ([ ]). Use it when the person refers to their pinned notes or asks what is left to do or test.",
      inputSchema: { type: 'object', properties: {} },
      isDeferred: false,
    })
    await $.tool.register({
      name: 'unpin',
      description:
        "Remove pins from the person's side pane: the pin with a title, or every pin with all: true; scope limits either to one board. Only when the person asks.",
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          all: { type: 'boolean' },
          scope: { type: 'string', enum: ['session', 'project'] },
        },
      },
      isDeferred: false,
    })

    try {
      loaded = { session: '', project: '' }
      await sync($)
      await pruneStaleSessions($, loaded.session)
    } catch {
      // The boards load with the first prompt instead.
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // After a /clear or a resume the process goes on under another session
    // id, and a /clear raises no session.start: drop this session's pins
    // (they stay on disk with it) and let the next sync load the new ones.
    if (e.reason === 'clear' || e.reason === 'resume') {
      loaded = { session: '', project: '' }
      try {
        await update($, pins, list => byScope(list, 'project'))
      } catch {
        // Nothing to keep up: the next sync replaces the list.
      }
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await sync($)
    } catch {
      // The pins wait for the next prompt; the prompt goes on.
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'pin' }, async ($, e) => {
    const { scope = 'session', rest } = parseScoped(e.args ?? '')
    const body = lastReply(await $.session.messages())
    if (body === '') return { text: 'There is no reply from Claude to pin yet.' }
    const { title, isPlaced } = await addPin($, { scope, body, title: rest || undefined })

    return { text: `Pinned "${title}" to the ${scope} board.${isPlaced ? '' : WAITING}` }
  })

  on('command.run', { command: 'pins' }, async $ => {
    await sync($)
    const isPlaced = await openPane($)

    return { text: isPlaced ? 'Pinned pane shown.' : 'The pinned pane could not be shown here.' }
  })

  on('command.run', { command: 'unpin' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    if (arg === '') return { text: UNPIN_USAGE }
    await sync($)
    const list = await read($, pins)
    if (list.length === 0) return { text: 'Nothing is pinned.' }

    if (arg === 'all' || arg === 'session' || arg === 'project') {
      const removed = new Set(list.filter(pin => arg === 'all' || pin.scope === arg).map(pin => pin.id))
      await mutate($, current => current.filter(pin => !removed.has(pin.id)))
      if ((await read($, pins)).length === 0) await $.ui.close({ id: PANE })

      return { text: `Removed ${plural(removed.size)}.` }
    }

    const target = findByLabel(list, arg)
    if (target === 'ambiguous') {
      return { text: `Both boards have a pin ${arg}: use s${arg} for the session's or p${arg} for the project's.` }
    }
    if (target === undefined) return { text: `There is no pin ${arg}. ${UNPIN_USAGE}` }
    await mutate($, current => current.filter(pin => pin.id !== target.id))

    return { text: `Removed "${target.title}".` }
  })

  on('tool.call', { tool: TOOL_PIN }, async ($, e) => {
    const input = e as unknown as { title?: unknown; markdown?: unknown; scope?: unknown }
    const body = asString(input.markdown).trim()
    if (body === '') return { deny: 'markdown is required and cannot be empty.' }
    const scope = asScope(input.scope) ?? 'session'
    const given = asString(input.title).trim()
    const { title, isPlaced } = await addPin($, { scope, body, title: given || undefined })

    return { result: `Pinned "${title}" to the ${scope} board.${isPlaced ? '' : WAITING}` }
  })

  on('tool.call', { tool: TOOL_LIST }, async $ => {
    await sync($)
    const list = await read($, pins)
    if (list.length === 0) return { result: 'Nothing is pinned.' }
    const boards = (['session', 'project'] as const)
      .map(scope => {
        const board = byScope(list, scope)
        if (board.length === 0) return ''
        const pinsText = board.map((pin, i) => `## ${label(scope, i)}. ${pin.title}\n\n${pin.body}`)

        return [`# ${scope === 'session' ? 'Session' : 'Project'} board`, ...pinsText].join('\n\n')
      })
      .filter(text => text !== '')

    return { result: boards.join('\n\n') }
  })

  on('tool.call', { tool: TOOL_UNPIN }, async ($, e) => {
    const input = e as unknown as { title?: unknown; all?: unknown; scope?: unknown }
    const scope = asScope(input.scope)
    await sync($)
    const list = await read($, pins)
    const onBoard = (pin: Pin) => scope === undefined || pin.scope === scope

    if (input.all === true) {
      const removed = new Set(list.filter(onBoard).map(pin => pin.id))
      await mutate($, current => current.filter(pin => !removed.has(pin.id)))

      return { result: `Removed ${plural(removed.size)}.` }
    }

    const title = asString(input.title).trim()
    const removed = new Set(list.filter(pin => onBoard(pin) && pin.title === title).map(pin => pin.id))
    if (removed.size === 0) {
      return { deny: `No pin is titled "${title}". Pinned: ${list.map(p => p.title).join(', ') || 'nothing'}.` }
    }
    await mutate($, current => current.filter(pin => !removed.has(pin.id)))

    return { result: `Removed "${title}".` }
  })

  // A pin control under each block of Claude's reply, shown only while the
  // pointer is over the block. Absolutely placed, so showing it moves no row;
  // where nothing reports the pointer (the terminal's main screen) it never shows.
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = await next(e)
    const text = e.props.text.trim()
    if (e.props.isSummary === true || text === '') return row
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return row
    const { Box, Text, Button } = $.ui.resolve(e)
    const pinAs = async (scope: PinScope) => {
      const { title } = await addPin($, { scope, body: text })
      $.ui.toast(`Pinned "${title}" to the ${scope} board.`)
    }

    return (
      <Box key={`pinrow:${e.requestId}`} flexDirection="column">
        {row}
        <Box
          position="absolute"
          bottom={0}
          right={0}
          display="none"
          hover={{ display: 'flex' }}
          flexDirection="row"
        >
          <Text> </Text>
          <Button key={`pin:${e.requestId}`} dimColor onPress={() => void pinAs('session')}>
            pin
          </Button>
          <Text> </Text>
          <Button key={`pinp:${e.requestId}`} dimColor onPress={() => void pinAs('project')}>
            pin project
          </Button>
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await read($, pins)

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Nothing pinned.</Text>
          <Text dimColor>/pin pins Claude's last reply; /pin project keeps it for the project.</Text>
        </Box>
      )
    }

    const root = await $.session.root().catch(() => '')
    const projectName = root.split('/').filter(part => part !== '').pop() ?? ''
    const boards = [
      { scope: 'session' as const, heading: 'This session', board: byScope(list, 'session') },
      {
        scope: 'project' as const,
        heading: projectName === '' ? 'Project' : `Project · ${projectName}`,
        board: byScope(list, 'project'),
      },
    ].filter(group => group.board.length > 0)

    // One card open at a time: the one picked, else the newest pin.
    const picked = await read($, openPin)
    const newest = list.reduce<Pin | undefined>(
      (latest, pin) => (latest === undefined || pin.pinnedAt >= latest.pinnedAt ? pin : latest),
      undefined,
    )
    const openId =
      picked === '' ? '' : picked !== null && list.some(pin => pin.id === picked) ? picked : (newest?.id ?? '')

    const drawPin = (pin: Pin, index: number) => {
      const count = progress(pin.body)
      const isOpen = pin.id === openId
      const header = (
        <Box flexDirection="row" justifyContent="space-between">
          <Button
            key={`hd:${pin.id}`}
            plain
            onPress={() => {
              void update($, openPin, () => (isOpen ? '' : pin.id))
            }}
          >
            {isOpen ? '▾ ' : '▸ '}
            <Text bold={isOpen}>
              {label(pin.scope, index)} · {pin.title}
            </Text>
            {count === '' ? '' : <Text dimColor>  {count}</Text>}
          </Button>
          <Button
            key={`rm:${pin.id}`}
            label="x"
            plain
            dimColor
            onPress={() => {
              void mutate($, current => current.filter(one => one.id !== pin.id))
            }}
          />
        </Box>
      )

      if (!isOpen) return header

      return (
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          {header}
          {segments(bodyBelowTitle(pin)).map(segment =>
            segment.kind === 'markdown' ? (
              <Markdown text={segment.text} />
            ) : (
              <Button
                key={`ck:${pin.id}:${segment.line}`}
                plain
                dimColor={segment.isDone}
                onPress={() => {
                  void mutate($, current =>
                    current.map(one =>
                      one.id === pin.id ? { ...one, body: toggleLine(one.body, segment.line) } : one,
                    ),
                  )
                }}
              >
                {' '.repeat(segment.indent)}
                {segment.isDone ? '[x] ' : '[ ] '}
                {segment.text}
              </Button>
            ),
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {boards.map(group => (
          <Box flexDirection="column">
            <Text dimColor bold>
              {group.heading}
            </Text>
            {group.board.map(drawPin)}
          </Box>
        ))}
      </Box>
    )
  })
}
