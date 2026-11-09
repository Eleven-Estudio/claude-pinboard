import type { On } from 'claude-code'

import { bandText } from '../lib/band'
import { failure, restore } from '../lib/board'
import { readIsMinimized, readOpenPin, readPins } from '../lib/state'

// While the pane is minimized, one line above the prompt: the count and the
// open pin. Pressing it brings the pane back. Otherwise the band is left to
// the engine and to other plugins.
export function hookBand(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await readIsMinimized($))) return next(e)
    const list = await readPins($)
    if (list.length === 0) return next(e)
    const { Box, Button } = $.ui.resolve(e)
    const text = bandText(list, await readOpenPin($), e.props.bodyColumns)

    return (
      <Box>
        <Button key="restore" plain onPress={() => void restore($).catch((error: unknown) => $.ui.toast(failure(error)))}>
          {text}
        </Button>
      </Box>
    )
  })
}
