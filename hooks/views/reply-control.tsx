import type { RenderChildren } from 'claude-code'

import type { PinScope } from '../../types'
import { addPin, failure } from '../lib/board'
import type { Ports } from '../lib/ports'
import type { Elements } from './elements'

// What a press on the control does: pins the block and says so, or says why
// it could not.
export function pinAction(ports: Ports, text: string, requestId: string): (scope: PinScope) => Promise<void> {
  return async scope => {
    try {
      const { title } = await addPin(ports, { scope, body: text, source: requestId })
      ports.ui.toast(`Pinned "${title}" to the ${scope} board.`)
    } catch (error) {
      ports.ui.toast(failure(error))
    }
  }
}

// A pin control under each block of Claude's reply, shown only while the
// pointer is over the block. Absolutely placed, so showing it moves no row;
// where nothing reports the pointer (the terminal's main screen) it never shows.
export function drawReplyControl(
  ui: Elements,
  reply: { row: RenderChildren; requestId: string },
  pinAs: (scope: PinScope) => Promise<void>,
) {
  const { Box, Text, Button } = ui
  const { row, requestId } = reply

  return (
    <Box key={`pinrow:${requestId}`} flexDirection="column">
      {row}
      <Box position="absolute" bottom={0} right={0} display="none" hover={{ display: 'flex' }} flexDirection="row">
        <Text> </Text>
        <Button key={`pin:${requestId}`} dimColor onPress={() => pinAs('session')}>
          pin
        </Button>
        <Text> </Text>
        <Button key={`pinp:${requestId}`} dimColor onPress={() => pinAs('project')}>
          pin project
        </Button>
      </Box>
    </Box>
  )
}
