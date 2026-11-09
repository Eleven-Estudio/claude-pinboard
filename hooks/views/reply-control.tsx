import type { On } from 'claude-code'

import type { PinScope } from '../../types'
import { addPin } from '../lib/board'

// A pin control under each block of Claude's reply, shown only while the
// pointer is over the block. Absolutely placed, so showing it moves no row;
// where nothing reports the pointer (the terminal's main screen) it never shows.
export function hookReplyControl(on: On): void {
  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    const row = await next(e)
    const text = e.props.text.trim()
    if (e.props.isSummary === true || text === '') return row
    if (e.surface !== 'terminal' && e.surface !== 'desktop') return row
    const { Box, Text, Button } = $.ui.resolve(e)
    const pinAs = async (scope: PinScope) => {
      const { title } = await addPin($, { scope, body: text })
      $.ui.toast(`Pinned "${title}" to the ${scope} board.`)
    }

    return (
      <Box key={`pinrow:${e.requestId}`} flexDirection="column">
        {row}
        <Box
          position="absolute"
          bottom={0}
          right={0}
          display="none"
          hover={{ display: 'flex' }}
          flexDirection="row"
        >
          <Text> </Text>
          <Button key={`pin:${e.requestId}`} dimColor onPress={() => void pinAs('session')}>
            pin
          </Button>
          <Text> </Text>
          <Button key={`pinp:${e.requestId}`} dimColor onPress={() => void pinAs('project')}>
            pin project
          </Button>
        </Box>
      </Box>
    )
  })
}
