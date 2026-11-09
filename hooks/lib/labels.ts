import type { Pin, PinScope } from '../../types'

export function byScope(list: readonly Pin[], scope: PinScope): Pin[] {
  return list.filter(pin => pin.scope === scope)
}

// `S1` for the first pin of the session board, `P2` for the second of the project's.
export function label(scope: PinScope, index: number): string {
  return `${scope === 'session' ? 'S' : 'P'}${index + 1}`
}

// `s2` / `p1` name a pin; a bare `2` does when only one board has pins.
export function findByLabel(list: readonly Pin[], arg: string): Pin | 'ambiguous' | undefined {
  const match = /^([sp])?(\d+)$/i.exec(arg)
  if (match === null) return undefined
  const index = Number(match[2]) - 1
  const prefix = match[1]?.toLowerCase()
  const session = byScope(list, 'session')
  const project = byScope(list, 'project')
  if (prefix === 's') return session[index]
  if (prefix === 'p') return project[index]
  if (project.length === 0) return session[index]
  if (session.length === 0) return project[index]

  return 'ambiguous'
}

// `/pin project Deploy notes` → scope project, rest "Deploy notes".
export function parseScoped(args: string): { scope: PinScope | undefined; rest: string } {
  const [first = '', ...rest] = args.trim().split(/\s+/)
  const word = first.toLowerCase()
  if (word === 'session' || word === 'project') return { scope: word, rest: rest.join(' ') }

  return { scope: undefined, rest: args.trim() }
}

export function plural(count: number): string {
  return `${count} pin${count === 1 ? '' : 's'}`
}
