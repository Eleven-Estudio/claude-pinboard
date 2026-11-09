# pinboard

Pin notes and checklists next to the chat in Claude Code, so they don't scroll away.

<!-- demo GIF goes here: docs/demo.gif -->

I kept losing the test checklist Claude gave me. A bug would show up halfway
through, the conversation would grow, and I'd scroll back up again and again to
find what was left to test. pinboard keeps that list in a pane beside the chat,
where you tick it off as you go.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install pinboard --marketplace Eleven-Estudio/claude-pinboard
```

Answer `y` to add the marketplace, then pick a scope. From a shell:

```
claude plugin install pinboard --marketplace Eleven-Estudio/claude-pinboard
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt
box, then **Plugins**, **Add marketplace** with `Eleven-Estudio/claude-pinboard`,
then **Add plugin**.

## Use

- **`/pin`** pins Claude's last reply. Give it a title with `/pin Login tests`.
- **Hover** over any block of a reply and click `pin` (fullscreen terminal or
  desktop app). The control is drawn over the block, so nothing moves.
- **Ask Claude**: "pin the steps I have to test". Claude can also read your pins
  back, so "what's left to test?" works after a detour.
- Lines written `- [ ] item` become **checkboxes** you tick in the pane.
- Pins are **cards**: one is open at a time, the rest fold to one line with their
  progress (`▸ S2 · Login tests  2/5`). Click a card's title to open it.

### Two boards

| Board | Labels | Shows up |
|---|---|---|
| Session | `S1`, `S2`… | In this conversation, and again when you resume it (`claude --resume` / `--continue`) |
| Project | `P1`, `P2`… | In every session you start in the same project folder |

`/pin` and the hover control use the session board; `/pin project` and
`pin project` use the project board.

### Commands

| Command | Does |
|---|---|
| `/pin [title]` | Pin Claude's last reply to the session board |
| `/pin project [title]` | Pin it to the project board |
| `/pins` | Show the pane again |
| `/unpin s2` · `/unpin p1` | Remove one pin |
| `/unpin session` · `/unpin project` · `/unpin all` | Clear a board, or both |

## What it stores and sends

- **Pins** are saved in pinboard's own store file, which Claude Code keeps under
  your Claude configuration directory. Session boards nobody touched in 90 days
  are deleted when a session starts; project boards stay until you unpin them.
- **Titles**: when you pin a reply without a title, pinboard sends that pin's
  text to `haiku` through your own Claude Code session (billed like any request
  of yours) and uses the short title it returns. If that fails, the pin keeps a
  title taken from its first heading or line.
- **Tools for Claude**: pinboard adds `pin`, `list_pins` and `unpin`. Claude
  reads your pins only when it calls `list_pins`.

## Limits

- At most **50 pins per board** (session and project each have their own).
- At most **20,000 characters per pin**.

Past either limit, `/pin`, the hover control and Claude's `pin` tool say so and
pin nothing. A change is written to disk before it shows in the pane: if the
write fails, nothing changes and you are told why.

## Requirements

- Claude Code with mods (plugins with a hooks module). Built and tested on
  2.1.319.
- The pane docks on the right in the fullscreen terminal from 110 columns wide,
  and sits above the prompt otherwise.
- The hover control needs the mouse: the fullscreen terminal or the desktop app.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

## License

[MIT](LICENSE)

---

Made by [Geovanny Gil](https://github.com/GeovannyGil) at [Eleven Estudio](https://elevenestudio.com).
