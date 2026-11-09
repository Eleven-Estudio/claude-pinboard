import type { UiScrollArgs, UiScrollResult } from 'claude-code'

import type { Ports, StoredBoard, TitleRequest } from '../hooks/lib/ports'
import type { Pin } from '../types'

// A `Ports` over memory, for tests that need no engine: the store is a Map,
// and every call the mod makes is recorded or can be held or made to fail.
export function fakePorts(
  options: { sessionId?: string; root?: string; stored?: Record<string, StoredBoard> } = {},
) {
  const disk = new Map<string, StoredBoard>(Object.entries(options.stored ?? {}))
  const toasts: string[] = []
  const scrolls: UiScrollArgs[] = []
  const panes = new Set<string>()
  const timers: (() => void)[] = []
  const calls = { opened: 0, closed: 0 }
  const fake = {
    pins: [] as Pin[],
    openPin: null as string | null,
    isMinimized: false,
    messages: [] as { role: string; text: string }[],
    scrollResult: {} as UiScrollResult,
    titleReply: '',
    isCloseBroken: false,
    // Set to hold the next write to the pins: resolve it to let the write land.
    holdPinsWrite: null as Promise<void> | null,
    // Called when a write to the pins reaches the hold.
    onPinsWriteHeld: () => {},
    writesLeft: null as number | null,
    failKey: null as RegExp | null,
  }

  const guard = (key: string) => {
    if (fake.failKey?.test(key) === true || fake.writesLeft === 0) throw new Error('disk full')
    if (fake.writesLeft !== null) fake.writesLeft -= 1
  }

  const ports: Ports = {
    store: {
      get: async key => disk.get(key),
      set: async (key, value) => {
        guard(key)
        disk.set(key, value)
      },
      delete: async key => {
        guard(key)
        disk.delete(key)
      },
      keys: async () => [...disk.keys()],
    },
    session: {
      id: async () => options.sessionId ?? 's1',
      root: async () => options.root ?? '/work/shop',
      messages: async () => fake.messages,
    },
    ui: {
      open: async request => {
        calls.opened++
        panes.add(request.id)

        return true
      },
      close: async id => {
        if (fake.isCloseBroken) throw new Error('no surface')
        calls.closed++
        panes.delete(id)
      },
      panes: async () => [...panes],
      toast: text => {
        toasts.push(text)
      },
      scroll: async args => {
        scrolls.push(args)

        return fake.scrollResult
      },
    },
    clock: {
      after: (_ms, task) => {
        timers.push(task)
      },
    },
    model: {
      complete: async (_request: TitleRequest) => fake.titleReply,
    },
    state: {
      readPins: async () => fake.pins,
      updatePins: async change => {
        const next = change(fake.pins)
        const held = fake.holdPinsWrite
        if (held !== null) {
          fake.holdPinsWrite = null
          fake.onPinsWriteHeld()
          await held
        }
        fake.pins = next
      },
      readOpenPin: async () => fake.openPin,
      setOpenPin: async id => {
        fake.openPin = id
      },
      readIsMinimized: async () => fake.isMinimized,
      setIsMinimized: async value => {
        fake.isMinimized = value
      },
    },
  }

  return { ports, fake, disk, toasts, scrolls, panes, timers, calls }
}
