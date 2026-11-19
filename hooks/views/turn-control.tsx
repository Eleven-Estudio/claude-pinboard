import type { RenderChildren } from 'claude-code'

import type { PinScope } from '../../types'
import type { Elements } from './elements'

// The turn's closing line ("Worked for 12s") with pin / pin project at its
// right edge, laid over the engine's own row rather than redrawing it, so
// whatever the engine writes there (the time, what it adds later) stays.
// Absolutely placed at the row's bottom, the line the text is on: the row has
// a blank line above it. Plain buttons with drawn brackets: a chrome button
// draws its label bold.
export function drawTurnControl(
  ui: Elements,
  line: { lineId: string; row: RenderChildren },
  pinAs: (scope: PinScope) => Promise<void>,
) {
  const { Box, Text, Button } = ui
  const { lineId, row } = line

  return (
    <Box key={`turnpin:${lineId}`} flexDirection="column">
      {row}
      <Box position="absolute" bottom={0} right={0} flexDirection="row">
        <Button key={`tpin:${lineId}`} plain dimColor onPress={() => pinAs('session')}>
          <Text weight="regular" dimColor>
            [ pin ]
          </Text>
        </Button>
        <Text> </Text>
        <Button key={`tpinp:${lineId}`} plain dimColor onPress={() => pinAs('project')}>
          <Text weight="regular" dimColor>
            [ pin project ]
          </Text>
        </Button>
      </Box>
    </Box>
  )
}
