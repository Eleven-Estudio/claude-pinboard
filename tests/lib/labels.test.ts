import { expect, test } from 'claude-code/testing'

import { byScope, findByLabel, label, parseScoped, plural } from '../../hooks/lib/labels'

const session = { id: 'a', title: 'A', body: '', scope: 'session', pinnedAt: 1 } as const
const project = { id: 'b', title: 'B', body: '', scope: 'project', pinnedAt: 2 } as const

test('labels name a pin by its board and place', async () => {
  expect(label('session', 0)).toBe('S1')
  expect(label('project', 2)).toBe('P3')
  expect(byScope([session, project], 'project')).toEqual([project])
})

test('a bare number names a pin only when one board has pins', async () => {
  expect(findByLabel([session], '1')).toBe(session)
  expect(findByLabel([project], '1')).toBe(project)
  expect(findByLabel([session, project], '1')).toBe('ambiguous')
  expect(findByLabel([session, project], 'P1')).toBe(project)
  expect(findByLabel([session, project], 's2')).toBeUndefined()
  expect(findByLabel([session], 'nope')).toBeUndefined()
})

test('a board word before the title picks the board', async () => {
  expect(parseScoped('project Deploy notes')).toEqual({ scope: 'project', rest: 'Deploy notes' })
  expect(parseScoped('Session')).toEqual({ scope: 'session', rest: '' })
  expect(parseScoped(' Login tests ')).toEqual({ scope: undefined, rest: 'Login tests' })
})

test('pins are counted in the singular and the plural', async () => {
  expect(plural(1)).toBe('1 pin')
  expect(plural(2)).toBe('2 pins')
})
