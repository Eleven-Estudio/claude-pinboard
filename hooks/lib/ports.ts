import type { UiScrollArgs, UiScrollResult } from 'claude-code'

import type { Pin } from '../../types'

// What a board stores under one key: the pins of a session or a project.
export type StoredBoard = { pins: Pin[]; updatedAt: number }

// What the title request asks of the small model.
export type TitleRequest = {
  model: string
  prompt: string
  maxTokens: number
  effort: 'low'
  timeoutMs: number
}

// Everything the mod asks of the engine, as small closures. Only
// `register.tsx` touches the engine's `$`; it builds these, and the rest of
// the mod works through them, so it can be tested with a fake.
export interface Ports {
  store: {
    get(key: string): Promise<unknown>
    set(key: string, value: StoredBoard): Promise<void>
    delete(key: string): Promise<void>
    keys(): Promise<string[]>
  }
  session: {
    id(): Promise<string>
    root(): Promise<string>
    messages(): Promise<readonly { role: string; text: string }[]>
  }
  ui: {
    // True when the surface placed the pane, false when it waits for room.
    open(request: { id: string; title: string }): Promise<boolean>
    close(id: string): Promise<void>
    panes(): Promise<string[]>
    toast(text: string): void
    scroll(args: UiScrollArgs): Promise<UiScrollResult>
  }
  clock: {
    after(ms: number, task: () => void): void
  }
  model: {
    // The reply's text, or '' when the model did not answer.
    complete(request: TitleRequest): Promise<string>
  }
  state: {
    readPins(): Promise<Pin[]>
    updatePins(change: (list: readonly Pin[]) => Pin[]): Promise<void>
    readOpenPin(): Promise<string | null>
    setOpenPin(id: string): Promise<void>
    readIsMinimized(): Promise<boolean>
    setIsMinimized(value: boolean): Promise<void>
  }
}
