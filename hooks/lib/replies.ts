// The AssistantMessage instances the render hook has seen, newest last, so
// /pin can tell which one holds the reply it pins: the session's messages
// carry no ids. A module variable on purpose (a render hook never writes
// $.state); a reload forgets it and a pin made then has no source.
const MAX_REPLIES = 200
const seen = new Map<string, string>()

export function rememberReply(requestId: string, text: string): void {
  // Drawing the same instance again keeps its place in the order.
  if (!seen.has(requestId) && seen.size >= MAX_REPLIES) {
    const oldest = seen.keys().next().value
    if (oldest !== undefined) seen.delete(oldest)
  }
  seen.set(requestId, text)
}

// The most recent instance whose text is exactly this reply, if any.
export function findReplySource(text: string): string | undefined {
  const wanted = text.trim()
  let found: string | undefined
  for (const [requestId, seenText] of seen) {
    if (seenText === wanted) found = requestId
  }

  return found
}
