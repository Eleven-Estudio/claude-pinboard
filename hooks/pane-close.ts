import type { On } from 'claude-code'

import { PANE } from './lib/board'
import { foldsOnClose } from './lib/close'
import { readPins, setIsMinimized } from './lib/state'

// The person closing the pane (the engine's close mark, ctrl+x x) folds it to
// the band instead, when there are pins to show. The close itself always goes
// through: this hook never keeps the pane open. A plugin's own close and an
// unload pass untouched.
export function hookPaneClose(on: On): void {
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (foldsOnClose(e.origin.kind, (await readPins($)).length)) await setIsMinimized($, true)

    return next(e)
  }).catch(($, e, next) => next(e))
}
