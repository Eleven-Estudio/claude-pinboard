import type { EngineInterface, Register, Shaped } from 'claude-code'

import type { Pin } from '../types'
import { commandSpecs, runPin, runPins, runUnpin } from './commands'
import { PANE, forgetSession, startBoards, sync } from './lib/board'
import { bandLine } from './lib/band'
import { foldOnClose } from './lib/close'
import type { Ports } from './lib/ports'
import { rememberReply } from './lib/replies'
import { listTool, pinTool, toolSpecs, unpinTool } from './tools'
import type { ToolInput } from './tools'
import { drawBand, restoreAction } from './views/band'
import { drawPane, paneActions, paneModel } from './views/pane'
import { drawReplyControl, pinAction } from './views/reply-control'

// This is the only file that holds the engine's `$` and `on`: it declares the
// hooks, and hands the rest of the mod a `Ports` built from `$`.

const TOOL_PIN = 'mcp__pinboard__pin'
const TOOL_UNPIN = 'mcp__pinboard__unpin'
const TOOL_LIST = 'mcp__pinboard__list_pins'

// The values in $.state, named by literals so the engine can list them.
const pinsRef = { plugin: 'pinboard', key: 'pins' } as const
const openPinRef = { plugin: 'pinboard', key: 'openPin' } as const
const isMinimizedRef = { plugin: 'pinboard', key: 'isMinimized' } as const

// Change the tag when Pin's fields change: an earlier version's value
// outlives a reload and is then read as empty instead of misread.
const PINS_SHAPE = 'pins-2'
// A write that keeps losing to others stops here instead of looping forever.
const MAX_WRITE_TRIES = 20

function unshape(stored: Shaped<Pin[]> | undefined): Pin[] {
  return stored?.shape === PINS_SHAPE ? stored.value : []
}

type Held<T> = { value: T | undefined; version: number }

// Reads, applies `change`, and writes only if nobody wrote in between; on a
// miss it reads again, so two quick changes both land.
async function updateHeld<T>(
  read: () => Promise<Held<T>>,
  write: (value: T, ifVersion: number) => Promise<{ isSet: boolean }>,
  change: (value: T | undefined) => T,
): Promise<void> {
  for (let tries = 0; tries < MAX_WRITE_TRIES; tries++) {
    const held = await read()
    const written = await write(change(held.value), held.version)
    if (written.isSet) return
  }
  throw new Error('The pane state kept changing; try again.')
}

function portsOf($: EngineInterface): Ports {
  return {
    store: {
      get: key => $.store.get(key),
      set: async (key, value) => {
        await $.store.set(key, value)
      },
      delete: async key => {
        await $.store.delete(key)
      },
      keys: () => $.store.keys(),
    },
    session: {
      id: () => $.session.id(),
      root: () => $.session.root(),
      messages: () => $.session.messages(),
    },
    ui: {
      open: async request => {
        const opened = await $.ui.open(request)

        return opened.isPlaced
      },
      close: async id => {
        await $.ui.close({ id })
      },
      panes: async () => {
        const panes = await $.ui.panes()

        return panes.map(pane => pane.id)
      },
      toast: text => $.ui.toast(text),
      scroll: args => $.ui.scroll(args),
    },
    clock: {
      after: (ms, task) => {
        $.clock.after(ms, task)
      },
    },
    model: {
      complete: async request => {
        const reply = await $.model.complete(request)

        return reply.isAnswered ? reply.text : ''
      },
    },
    state: {
      readPins: async () => {
        const held = await $.state.get(pinsRef)

        return unshape(held.value)
      },
      updatePins: change =>
        updateHeld(
          () => $.state.get(pinsRef),
          (value, ifVersion) => $.state.set(pinsRef, value, { ifVersion }),
          stored => ({ shape: PINS_SHAPE, value: change(unshape(stored)) }),
        ),
      readOpenPin: async () => {
        const held = await $.state.get(openPinRef)

        return held.value ?? null
      },
      setOpenPin: async id => {
        await $.state.set(openPinRef, id)
      },
      readIsMinimized: async () => {
        const held = await $.state.get(isMinimizedRef)

        return held.value ?? false
      },
      setIsMinimized: async value => {
        await $.state.set(isMinimizedRef, value)
      },
    },
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    for (const spec of commandSpecs) await $.command.register(spec)
    for (const spec of toolSpecs) await $.tool.register(spec)

    try {
      await startBoards(portsOf($))
    } catch {
      // The boards load with the first prompt instead.
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // A /clear raises no session.start, so the old session's pins go here.
    if (e.reason === 'clear' || e.reason === 'resume') {
      try {
        await forgetSession(portsOf($))
      } catch {
        // Nothing to keep up: the next sync replaces the list.
      }
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    try {
      await sync(portsOf($))
    } catch {
      // The pins wait for the next prompt; the prompt goes on.
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'pin' }, async ($, e) => ({ text: await runPin(portsOf($), e.args ?? '') }))

  on('command.run', { command: 'pins' }, async $ => ({ text: await runPins(portsOf($)) }))

  on('command.run', { command: 'unpin' }, async ($, e) => ({ text: await runUnpin(portsOf($), e.args ?? '') }))

  on('tool.call', { tool: TOOL_PIN }, async ($, e) => pinTool(portsOf($), e as unknown as ToolInput))

  on('tool.call', { tool: TOOL_LIST }, async $ => listTool(portsOf($)))

  on('tool.call', { tool: TOOL_UNPIN }, async ($, e) => unpinTool(portsOf($), e as unknown as ToolInput))

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = await next(e)
    const text = e.props.text.trim()
    if (e.props.isSummary === true || text === '') return row
    rememberReply(e.requestId, text)
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return row
    const pinAs = pinAction(portsOf($), text, e.requestId)

    return drawReplyControl($.ui.resolve(e), { row, requestId: e.requestId }, pinAs)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ports = portsOf($)
    const ui = $.ui.resolve(e)

    return drawPane(ui, await paneModel(ports), paneActions(ports))
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const ports = portsOf($)
    const text = e.props.hasSurvey ? undefined : await bandLine(ports, e.props.bodyColumns)
    if (text === undefined) return next(e)

    return drawBand($.ui.resolve(e), text, restoreAction(ports))
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    await foldOnClose(portsOf($), e.origin.kind)

    return next(e)
  }).catch(($, e, next) => next(e))
}
