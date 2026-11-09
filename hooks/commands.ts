import type { CommandSpec, On } from 'claude-code'

import { PANE, WAITING, addPin, failure, isPaneUp, minimize, mutate, restore, sync } from './lib/board'
import { findReplySource } from './lib/replies'
import { findByLabel, parseScoped, plural } from './lib/labels'
import { readPins } from './lib/state'

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

export function hookCommands(on: On): void {
  on('command.run', { command: 'pin' }, async ($, e) => {
    const { scope = 'session', rest } = parseScoped(e.args ?? '')
    const body = lastReply(await $.session.messages())
    if (body === '') return { text: 'There is no reply from Claude to pin yet.' }
    try {
      const source = findReplySource(body)
      const { title, isPlaced } = await addPin($, { scope, body, title: rest || undefined, source })

      return { text: `Pinned "${title}" to the ${scope} board.${isPlaced ? '' : WAITING}` }
    } catch (error) {
      return { text: failure(error) }
    }
  })

  on('command.run', { command: 'pins' }, async $ => {
    await sync($)
    if (await isPaneUp($)) {
      if ((await readPins($)).length === 0) {
        await $.ui.close({ id: PANE })

        return { text: 'Pinned pane closed.' }
      }
      await minimize($)

      return { text: 'Pinned pane minimized to a band above the prompt. /pins brings it back.' }
    }
    const isPlaced = await restore($)

    return { text: isPlaced ? 'Pinned pane shown.' : 'The pinned pane could not be shown here.' }
  })

  on('command.run', { command: 'unpin' }, async ($, e) => {
    const arg = (e.args ?? '').trim().toLowerCase()
    if (arg === '') return { text: UNPIN_USAGE }
    await sync($)
    const list = await readPins($)
    if (list.length === 0) return { text: 'Nothing is pinned.' }

    if (arg === 'all' || arg === 'session' || arg === 'project') {
      const removed = new Set(list.filter(pin => arg === 'all' || pin.scope === arg).map(pin => pin.id))
      try {
        await mutate($, current => current.filter(pin => !removed.has(pin.id)))
      } catch (error) {
        return { text: failure(error) }
      }

      return { text: `Removed ${plural(removed.size)}.` }
    }

    const target = findByLabel(list, arg)
    if (target === 'ambiguous') {
      return { text: `Both boards have a pin ${arg}: use s${arg} for the session's or p${arg} for the project's.` }
    }
    if (target === undefined) return { text: `There is no pin ${arg}. ${UNPIN_USAGE}` }
    try {
      await mutate($, current => current.filter(pin => pin.id !== target.id))
    } catch (error) {
      return { text: failure(error) }
    }

    return { text: `Removed "${target.title}".` }
  })
}
