// Whether a close of the pane folds it to the band: only the person's own
// close (the close mark, ctrl+x x), and only when there is something to show.
// A plugin's close and an unload leave the fold as it was.
export function foldsOnClose(origin: 'plugin' | 'person' | 'unload', pinCount: number): boolean {
  return origin === 'person' && pinCount > 0
}
