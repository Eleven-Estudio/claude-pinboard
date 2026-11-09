# Demo script

About 60–90 seconds. Type the prompts as written; Claude's words will vary, the
story won't. Corner Coffee's checkout has a real bug: `SAVE10` makes the order
free.

| # | You do | What the viewer sees |
|---|---|---|
| 1 | Type: `I added discount codes to checkout. Give me a short checklist to test them by hand, as - [ ] items.` | Claude answers with a checklist |
| 2 | Hover over the reply and click **pin** | The pane opens on the right with the checklist; a second later its title turns into a short one |
| 3 | Click the first item | It ticks off: `1/5` |
| 4 | Type: `SAVE10 makes the whole order free. Find out why and fix it.` | Claude runs the tests, finds `/ 10`, fixes it, tests pass. The conversation scrolls; the checklist stays put |
| 5 | Click the items the fix covers | Progress moves: `3/5` |
| 6 | Type: `What's left to test?` | Claude reads the pins and lists the open items |
| 7 | *(optional)* Type `/exit`, then run `demo/start.sh --continue` | The same pins come back with the session |

Tips:

- Pause a beat after each click so the GIF shows the change.
- If Claude's checklist has no `- [ ]` items, say "as a checklist with - [ ] items" again
  and pin the new reply.
- A second pin (e.g. `/pin project Release notes` after any reply) shows the cards
  folding: one open at a time.
