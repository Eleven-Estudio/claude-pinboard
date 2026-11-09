import type { CommandSpec } from 'claude-code'

import { PANE, addPin, failure, isPaneUp, minimize, mutate, paneNote, restore, sync } from './lib/board'
import { findByLabel, parseScoped, plural } from './lib/labels'
import type { Ports } from './lib/ports'
import { findReplySource } from './lib/replies'

const UNPIN_USAGE = 'Usage: /unpin s1 | p2 | session | project | all'

export const commandSpecs: CommandSpec[] = [
  {
    name: 'pin',
    description: "Pin Claude's last reply to this session's board, or the project's",
    argumentHint: '[session|project] [title]',
    immediate: true,
  },
  {
    name: 'pins',
    description: 'Show the pinned notes pane, or fold it to a band above the prompt',
    immediate: true,
  },
  {
    name: 'unpin',
    description: 'Remove a pin (s1, p2) or a whole board (session, project, all)',
    argumentHint: 's1 | p2 | session | project | all',
    immediate: true,
  },
]

function lastReply(messages: readonly { role: string; text: string }[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i]
    if (message?.role === 'assistant' && message.text.trim() !== '') {
      return message.text.trim()
    }
  }

  return ''
}

// What each command answers, as the text the person reads.

export async function runPin(ports: Ports, args: string): Promise<string> {
  const { scope = 'session', rest } = parseScoped(args)
  const body = lastReply(await ports.session.messages())
  if (body === '') return 'There is no reply from Claude to pin yet.'
  try {
    const source = findReplySource(body)
    const pin = await addPin(ports, { scope, body, title: rest || undefined, source })

    return `Pinned "${pin.title}" to the ${scope} board.${paneNote(pin)}`
  } catch (error) {
    return failure(error)
  }
}

export async function runPins(ports: Ports): Promise<string> {
  await sync(ports)
  if (await isPaneUp(ports)) {
    if ((await ports.state.readPins()).length === 0) {
      await ports.ui.close(PANE)

      return 'Pinned pane closed.'
    }
    await minimize(ports)

    return 'Pinned pane minimized to a band above the prompt. /pins brings it back.'
  }
  const isPlaced = await restore(ports)

  return isPlaced ? 'Pinned pane shown.' : 'The pinned pane could not be shown here.'
}

export async function runUnpin(ports: Ports, args: string): Promise<string> {
  const arg = args.trim().toLowerCase()
  if (arg === '') return UNPIN_USAGE
  await sync(ports)
  const list = await ports.state.readPins()
  if (list.length === 0) return 'Nothing is pinned.'

  if (arg === 'all' || arg === 'session' || arg === 'project') {
    const removed = new Set(list.filter(pin => arg === 'all' || pin.scope === arg).map(pin => pin.id))
    try {
      await mutate(ports, current => current.filter(pin => !removed.has(pin.id)))
    } catch (error) {
      return failure(error)
    }

    return `Removed ${plural(removed.size)}.`
  }

  const target = findByLabel(list, arg)
  if (target === 'ambiguous') {
    return `Both boards have a pin ${arg}: use s${arg} for the session's or p${arg} for the project's.`
  }
  if (target === undefined) return `There is no pin ${arg}. ${UNPIN_USAGE}`
  try {
    await mutate(ports, current => current.filter(pin => pin.id !== target.id))
  } catch (error) {
    return failure(error)
  }

  return `Removed "${target.title}".`
}
