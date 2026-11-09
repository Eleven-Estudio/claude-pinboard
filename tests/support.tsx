import type { TestBody } from 'claude-code/testing'

type On = Parameters<TestBody>[1]

export const PANE = {
  plugin: 'pinboard',
  component: 'Pane',
  requestId: 'pinboard',
  props: {
    title: 'Pinned',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

export const CHECKLIST = '## Login\n\n- [ ] Log in with a test account\n- [ ] Log out'
export const START = { cwd: '/work/shop', surface: 'desktop', isInteractive: true } as const
export const USAGE = {
  input_tokens: 1,
  output_tokens: 1,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
}

export type Saved = { pins: { title: string; body: string }[] }

// Nothing sits beneath the plugin: these hooks stand for the engine. The
// plugin's store is a Map the test reads back, standing for the file on disk;
// `store.isBroken` makes every write throw, as a full disk does.
export function engine(on: On, stored: Record<string, unknown> = {}) {
  const disk = new Map<string, unknown>(Object.entries(stored))
  const toasts: string[] = []
  const store = { isBroken: false }
  const guard = () => {
    if (store.isBroken) throw new Error('disk full')
  }
  on('store.get', (_, e) => ({ value: disk.get(e.key) }))
  on('store.set', (_, e) => (guard(), disk.set(e.key, e.value), { value: undefined }))
  on('store.delete', (_, e) => (guard(), disk.delete(e.key), { value: undefined }))
  on('store.keys', () => ({ value: [...disk.keys()] }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('tool.register', (_, e) => ({ value: { tool: `mcp__pinboard__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }))
  on('ui.close', () => ({ value: undefined }))
  on('ui.toast', (_, e) => (toasts.push(e.text), { value: undefined }))
  on('session.id', () => ({ value: 's1' }))
  on('session.root', () => ({ value: '/work/shop' }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))

  return { disk, toasts, store }
}

// Stands for the engine drawing a reply block itself.
export function engineRow(on: On) {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine row</Text>
  })
}

// Stands for the session's messages, the last from Claude.
export function reply(on: On, text: string) {
  on('session.messages', () => ({ value: [{ role: 'assistant', text, toolUses: [] }] }))
}

export function pinOf(title: string, body: string, pinnedAt = 1) {
  return { id: title, title, body, pinnedAt }
}

export const pinCall = (title: string, markdown: string, scope?: 'session' | 'project') =>
  ({ tool: 'mcp__pinboard__pin', title, markdown, scope }) as const

export const LIST_CALL = { tool: 'mcp__pinboard__list_pins' } as const

export const unpinCall = (args: { title?: string; all?: boolean; scope?: 'session' | 'project' }) =>
  ({ tool: 'mcp__pinboard__unpin', ...args }) as const
