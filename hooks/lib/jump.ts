import type { EngineInterface, UiScrollArgs } from 'claude-code'

// Where the jump lands: the top of the render instance the pin came from.
export function scrollArgs(source: string): UiScrollArgs {
  return { to: { requestId: source }, block: 'start' }
}

// Scrolls the transcript to where a pin came from. It answers true when the
// view moved, false when it did not: the reply was compacted away or cleared,
// or the engine refused. Call it from a press only, which is the person's
// input and what scrolling a transcript row requires.
export async function jumpTo($: EngineInterface, source: string): Promise<boolean> {
  try {
    const moved = await $.ui.scroll(scrollArgs(source))

    return moved.deny === undefined
  } catch {
    return false
  }
}
