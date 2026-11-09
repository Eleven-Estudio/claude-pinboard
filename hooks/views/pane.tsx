import type { On } from 'claude-code'

import type { Pin } from '../../types'
import { PANE, failure, mutate } from '../lib/board'
import { progress, segments, toggleLine } from '../lib/checklist'
import { byScope, label } from '../lib/labels'
import { readOpenPin, readPins, setOpenPin } from '../lib/state'
import { bodyBelowTitle } from '../lib/title'

// The pane: pins grouped by board, one card open at a time.
export function hookPane(on: On): void {
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown } = $.ui.resolve(e)
    const list = await readPins($)

    if (list.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Nothing pinned.</Text>
          <Text dimColor>/pin pins Claude's last reply; /pin project keeps it for the project.</Text>
        </Box>
      )
    }

    const root = await $.session.root().catch(() => '')
    const projectName = root.split('/').filter(part => part !== '').pop() ?? ''
    const boards = [
      { heading: 'This session', board: byScope(list, 'session') },
      {
        heading: projectName === '' ? 'Project' : `Project · ${projectName}`,
        board: byScope(list, 'project'),
      },
    ].filter(group => group.board.length > 0)

    // One card open at a time: the one picked, else the newest pin.
    const picked = await readOpenPin($)
    const newest = list.reduce<Pin | undefined>(
      (latest, pin) => (latest === undefined || pin.pinnedAt >= latest.pinnedAt ? pin : latest),
      undefined,
    )
    const openId =
      picked === '' ? '' : picked !== null && list.some(pin => pin.id === picked) ? picked : (newest?.id ?? '')

    // A press that cannot be saved leaves the pane as it was and says why.
    const change = (edit: (current: readonly Pin[]) => Pin[]) => {
      mutate($, edit).catch((error: unknown) => $.ui.toast(failure(error)))
    }

    const drawPin = (pin: Pin, index: number) => {
      const count = progress(pin.body)
      const isOpen = pin.id === openId
      const header = (
        <Box flexDirection="row" justifyContent="space-between">
          <Button
            key={`hd:${pin.id}`}
            plain
            onPress={() => {
              void setOpenPin($, isOpen ? '' : pin.id)
            }}
          >
            {isOpen ? '▾ ' : '▸ '}
            <Text bold={isOpen}>
              {label(pin.scope, index)} · {pin.title}
            </Text>
            {count === '' ? '' : <Text dimColor>  {count}</Text>}
          </Button>
          <Button
            key={`rm:${pin.id}`}
            label="x"
            plain
            dimColor
            onPress={() => change(current => current.filter(one => one.id !== pin.id))}
          />
        </Box>
      )

      if (!isOpen) return header

      return (
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          {header}
          {segments(bodyBelowTitle(pin)).map(segment =>
            segment.kind === 'markdown' ? (
              <Markdown text={segment.text} />
            ) : (
              <Button
                key={`ck:${pin.id}:${segment.line}`}
                plain
                dimColor={segment.isDone}
                onPress={() =>
                  change(current =>
                    current.map(one =>
                      one.id === pin.id ? { ...one, body: toggleLine(one.body, segment.line) } : one,
                    ),
                  )
                }
              >
                {' '.repeat(segment.indent)}
                {segment.isDone ? '[x] ' : '[ ] '}
                {segment.text}
              </Button>
            ),
          )}
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {boards.map(group => (
          <Box flexDirection="column">
            <Text dimColor bold>
              {group.heading}
            </Text>
            {group.board.map(drawPin)}
          </Box>
        ))}
      </Box>
    )
  })
}
