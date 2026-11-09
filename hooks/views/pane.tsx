import type { Pin } from '../../types'
import { failure, minimize, mutate } from '../lib/board'
import { progress, segments, toggleTask } from '../lib/checklist'
import type { Segment } from '../lib/checklist'
import { jumpTo } from '../lib/jump'
import { byScope, label } from '../lib/labels'
import { resolveOpenId } from '../lib/open-pin'
import type { Ports } from '../lib/ports'
import { bodyBelowTitle } from '../lib/title'
import type { Elements } from './elements'

// What the pane draws: the pins, the project's folder name, the open card.
export type PaneModel = { list: Pin[]; projectName: string; openId: string }

export async function paneModel(ports: Ports): Promise<PaneModel> {
  const list = await ports.state.readPins()
  const root = await ports.session.root().catch(() => '')
  const projectName = root.split('/').filter(part => part !== '').pop() ?? ''
  // One card open at a time: the one picked, else the newest pin.
  const openId = resolveOpenId(await ports.state.readOpenPin(), list)

  return { list, projectName, openId }
}

// What a press in the pane does. Each one is a person's input, and a failure
// leaves the pane as it was and says why.
export type PaneActions = {
  toggleOpen(pin: Pin, isOpen: boolean): Promise<void>
  remove(pin: Pin): Promise<void>
  tick(pin: Pin, segment: Extract<Segment, { kind: 'check' }>): Promise<void>
  jump(source: string): Promise<void>
  minimize(): Promise<void>
}

export function paneActions(ports: Ports): PaneActions {
  const say = (error: unknown) => ports.ui.toast(failure(error))
  const change = (edit: (current: readonly Pin[]) => Pin[]) => mutate(ports, edit).catch(say)

  return {
    toggleOpen: (pin, isOpen) => ports.state.setOpenPin(isOpen ? '' : pin.id).catch(say),
    remove: pin => change(current => current.filter(one => one.id !== pin.id)),
    tick: (pin, segment) =>
      change(current =>
        current.map(one =>
          one.id === pin.id ? { ...one, body: toggleTask(one.body, segment.line, segment.raw) } : one,
        ),
      ),
    jump: async source => {
      if (!(await jumpTo(ports, source))) ports.ui.toast('That reply is no longer in the view.')
    },
    minimize: () => minimize(ports).catch(say),
  }
}

export function drawPane(ui: Elements, model: PaneModel, actions: PaneActions) {
  const { Box, Text, Button, Markdown } = ui
  const { list, projectName, openId } = model

  if (list.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>Nothing pinned.</Text>
        <Text dimColor>/pin pins Claude's last reply; /pin project keeps it for the project.</Text>
      </Box>
    )
  }

  const boards = [
    { heading: 'This session', board: byScope(list, 'session') },
    {
      heading: projectName === '' ? 'Project' : `Project · ${projectName}`,
      board: byScope(list, 'project'),
    },
  ].filter(group => group.board.length > 0)

  const drawPin = (pin: Pin, index: number) => {
    const count = progress(pin.body)
    const isOpen = pin.id === openId
    const header = (
      <Box flexDirection="row" justifyContent="space-between">
        <Button key={`hd:${pin.id}`} plain onPress={() => actions.toggleOpen(pin, isOpen)}>
          {isOpen ? '▾ ' : '▸ '}
          <Text bold={isOpen}>
            {label(pin.scope, index)} · {pin.title}
          </Text>
          {count === '' ? '' : <Text dimColor>  {count}</Text>}
        </Button>
        <Box flexDirection="row">
          {pin.source === undefined ? null : (
            <Button
              key={`go:${pin.id}`}
              label="↑ "
              plain
              dimColor
              onPress={() => actions.jump(pin.source ?? '')}
            />
          )}
          <Button key={`rm:${pin.id}`} label="x" plain dimColor onPress={() => actions.remove(pin)} />
        </Box>
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
              onPress={() => actions.tick(pin, segment)}
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
      <Box flexDirection="row" justifyContent="flex-end">
        <Button key="minimize" label="–" plain dimColor onPress={() => actions.minimize()} />
      </Box>
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
}
