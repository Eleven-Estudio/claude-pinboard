import type { EngineInterface } from 'claude-code'

// The element constructors a render hook gets from `$.ui.resolve(e)`: the
// views draw with them and never see the engine.
export type Elements = ReturnType<EngineInterface['ui']['resolve']>
