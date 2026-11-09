export type PinScope = 'session' | 'project'

export type Pin = {
  id: string
  title: string
  // Markdown. Lines written `- [ ] item` / `- [x] item` are drawn as
  // checkboxes the person can tick; ticking rewrites the line here.
  body: string
  scope: PinScope
  pinnedAt: number
  // The render requestId of where the pin came from: the reply's message id,
  // or the tool_use_id of the call that pinned it. Absent on older pins and
  // where the reply could not be told apart.
  source?: string
}

declare module 'claude-code' {
  interface PluginState {
    // openPin: the one card shown open; null until the person picks one (the
    // newest pin is open then), '' when they closed every card.
    // isMinimized: the pane is folded to a one-line band above the prompt. It
    // belongs to the session: a new one, and a /clear or resume, start unfolded.
    pinboard: { pins: Shaped<Pin[]>; openPin: string | null; isMinimized: boolean }
  }
}
