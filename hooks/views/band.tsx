import { failure, restore } from '../lib/board'
import type { Ports } from '../lib/ports'
import type { Elements } from './elements'

// What a press on the band does: brings the pane back. A failure leaves the
// band as it was and says why.
export function restoreAction(ports: Ports): () => Promise<unknown> {
  return () => restore(ports).catch((error: unknown) => ports.ui.toast(failure(error)))
}

// The minimized band: one line, pressed to bring the pane back.
export function drawBand(ui: Elements, text: string, onPress: () => Promise<unknown>) {
  const { Box, Button } = ui

  return (
    <Box>
      <Button key="restore" plain onPress={onPress}>
        {text}
      </Button>
    </Box>
  )
}
