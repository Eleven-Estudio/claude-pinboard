import type { PinScope } from '../../types'
import type { Elements } from './elements'

// The duration as the engine's line writes it: 3s, 1m 4s, 1h 2m.
export function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`

  return `${Math.floor(m / 60)}h ${m % 60}m`
}

// The turn's closing line ("Worked for 12s") with pin / pin project at its
// right edge. Redrawn rather than wrapped: the engine's row spans the full
// width with a blank line above, so anything beside it lands on that line.
// The controls sit in their own cells, so they never cover text of the reply
// and a selection never lands on them. Plain buttons with drawn brackets: a
// chrome button draws its label bold.
export function drawTurnControl(
  ui: Elements,
  line: { lineId: string; word: string; durationMs: number },
  pinAs: (scope: PinScope) => Promise<void>,
) {
  const { Box, Text, Button } = ui
  const { lineId, word, durationMs } = line

  return (
    <Box key={`turnpin:${lineId}`} flexDirection="row" width="100%" marginTop={1}>
      <Text dimColor>
        ✻ {word} for {duration(durationMs)}
      </Text>
      <Box flexGrow={1} />
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
  )
}
