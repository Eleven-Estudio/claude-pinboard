import type { ToolSpec } from 'claude-code'

import type { Pin, PinScope } from '../types'
import { addPin, failure, mutate, paneNote, sync } from './lib/board'
import { byScope, label, plural } from './lib/labels'
import type { Ports } from './lib/ports'


export const toolSpecs: ToolSpec[] = [
  {
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
  },
  {
    name: 'list_pins',
    description:
      "Read what is pinned in the person's side pane, on the session's board and the project's, with which checklist items they have ticked ([x]) and which are still open ([ ]). Use it when the person refers to their pinned notes or asks what is left to do or test.",
    inputSchema: { type: 'object', properties: {} },
    isDeferred: false,
  },
  {
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
  },
]

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asScope(value: unknown): PinScope | undefined {
  return value === 'session' || value === 'project' ? value : undefined
}

function boardText(list: readonly Pin[], scope: PinScope): string {
  const board = byScope(list, scope)
  if (board.length === 0) return ''
  const heading = `# ${scope === 'session' ? 'Session' : 'Project'} board`
  const cards = board.map((pin, index) => `## ${label(scope, index)}. ${pin.title}\n\n${pin.body}`)

  return [heading, ...cards].join('\n\n')
}

// What a tool answers: `result` for the model, or `deny` with the reason.
export type ToolAnswer = { result: string } | { deny: string }

// What the model sends, whatever it sent: every field is checked before use.
export type ToolInput = Record<string, unknown>

export async function pinTool(ports: Ports, input: ToolInput): Promise<ToolAnswer> {
  const body = asString(input.markdown).trim()
  if (body === '') return { deny: 'markdown is required and cannot be empty.' }
  const scope = asScope(input.scope) ?? 'session'
  const given = asString(input.title).trim()
  try {
    const pin = await addPin(ports, {
      scope,
      body,
      title: given || undefined,
      source: asString(input.tool_use_id) || undefined,
    })

    return { result: `Pinned "${pin.title}" to the ${scope} board.${paneNote(pin)}` }
  } catch (error) {
    return { deny: failure(error) }
  }
}

export async function listTool(ports: Ports): Promise<ToolAnswer> {
  await sync(ports)
  const list = await ports.state.readPins()
  if (list.length === 0) return { result: 'Nothing is pinned.' }
  const boards = [boardText(list, 'session'), boardText(list, 'project')].filter(text => text !== '')

  return { result: boards.join('\n\n') }
}

export async function unpinTool(ports: Ports, input: ToolInput): Promise<ToolAnswer> {
  const scope = asScope(input.scope)
  await sync(ports)
  const list = await ports.state.readPins()
  const onBoard = (pin: Pin) => scope === undefined || pin.scope === scope

  if (input.all === true) {
    const removed = new Set(list.filter(onBoard).map(pin => pin.id))
    try {
      await mutate(ports, current => current.filter(pin => !removed.has(pin.id)))
    } catch (error) {
      return { deny: failure(error) }
    }

    return { result: `Removed ${plural(removed.size)}.` }
  }

  const title = asString(input.title).trim()
  const removed = new Set(list.filter(pin => onBoard(pin) && pin.title === title).map(pin => pin.id))
  if (removed.size === 0) {
    return { deny: `No pin is titled "${title}". Pinned: ${list.map(pin => pin.title).join(', ') || 'nothing'}.` }
  }
  try {
    await mutate(ports, current => current.filter(pin => !removed.has(pin.id)))
  } catch (error) {
    return { deny: failure(error) }
  }

  return { result: `Removed "${title}".` }
}
