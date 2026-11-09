import type { Register } from 'claude-code'

import { commandSpecs, hookCommands } from './commands'
import { forgetSession, startBoards, sync } from './lib/board'
import { hookTools, toolSpecs } from './tools'
import { hookPane } from './views/pane'
import { hookReplyControl } from './views/reply-control'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const spec of commandSpecs) await $.command.register(spec)
    for (const spec of toolSpecs) await $.tool.register(spec)

    try {
      await startBoards($)
    } catch {
      // The boards load with the first prompt instead.
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // A /clear raises no session.start, so the old session's pins go here.
    if (e.reason === 'clear' || e.reason === 'resume') {
      try {
        await forgetSession($)
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

  hookCommands(on)
  hookTools(on)
  hookReplyControl(on)
  hookPane(on)
}
