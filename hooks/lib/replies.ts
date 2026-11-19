// The AssistantMessage instances the render hook has seen, newest last, so
// /pin can tell which one holds the reply it pins: the session's messages
// carry no ids. A module variable on purpose (a render hook never writes
// $.state); a reload forgets it and a pin made then has no source.
const MAX_REPLIES = 200
const seen = new Map<string, string>()
// The newest block drawn for the first time: when a turn's closing line is
// first drawn, the turn's last block, its answer. A redrawn old block (a
// scroll, a resize) does not move it.
let newest: { requestId: string; text: string } | undefined

export function rememberReply(requestId: string, text: string): void {
  // Drawing the same instance again keeps its place in the order.
  if (!seen.has(requestId)) {
    if (seen.size >= MAX_REPLIES) {
      const oldest = seen.keys().next().value
      if (oldest !== undefined) seen.delete(oldest)
    }
    newest = { requestId, text }
  } else if (newest?.requestId === requestId) {
    newest = { requestId, text }
  }
  seen.set(requestId, text)
}

// A block shorter than this is not matched inside a longer reply: "Done." or
// "Yes" would match almost any reply and point the jump at the wrong place.
const MIN_BLOCK_CHARS = 20

// The instance a pinned reply came from. The session's messages join a reply's
// text blocks while each block is drawn on its own, so a block matches when it
// is the whole reply or (past MIN_BLOCK_CHARS) a part of it. The block that
// opens earliest in the reply wins, so the jump lands at its start; among
// identical blocks, the most recent.
export function findReplySource(text: string): string | undefined {
  const reply = text.trim()
  let found: string | undefined
  let foundAt = Infinity
  for (const [requestId, block] of seen) {
    const at = block === reply ? 0 : block.length >= MIN_BLOCK_CHARS ? reply.indexOf(block) : -1
    if (at !== -1 && at <= foundAt) {
      found = requestId
      foundAt = at
    }
  }

  return found
}

// Each turn line keeps the block it was first drawn after, so redrawing an
// old line still pins that turn's block and not the newest one.
const MAX_LINES = 200
const ofLine = new Map<string, { requestId: string; text: string }>()

export function replyOfLine(lineId: string): { requestId: string; text: string } | undefined {
  const kept = ofLine.get(lineId)
  if (kept) return kept
  const reply = newest
  if (!reply) return undefined
  if (ofLine.size >= MAX_LINES) {
    const oldest = ofLine.keys().next().value
    if (oldest !== undefined) ofLine.delete(oldest)
  }
  ofLine.set(lineId, reply)

  return reply
}

// For tests: module state outlives a test file's engine.
export function resetReplies(): void {
  seen.clear()
  ofLine.clear()
  newest = undefined
}
