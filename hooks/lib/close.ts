import type { Ports } from './ports'

// Whether a close of the pane folds it to the band: only the person's own
// close (the close mark, ctrl+x x), and only when there is something to show.
// A plugin's close and an unload leave the fold as it was.
export function foldsOnClose(origin: 'plugin' | 'person' | 'unload', pinCount: number): boolean {
  return origin === 'person' && pinCount > 0
}

// Called as the pane closes: folds it when the close is the person's.
export async function foldOnClose(ports: Ports, origin: 'plugin' | 'person' | 'unload'): Promise<void> {
  const pins = await ports.state.readPins()
  if (foldsOnClose(origin, pins.length)) await ports.state.setIsMinimized(true)
}
