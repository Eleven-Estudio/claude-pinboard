# pinboard

[![CI](https://github.com/Eleven-Estudio/claude-pinboard/actions/workflows/ci.yml/badge.svg)](https://github.com/Eleven-Estudio/claude-pinboard/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/github/license/Eleven-Estudio/claude-pinboard)](LICENSE)

Pin notes and checklists next to the chat in Claude Code, so they don't scroll away.

https://github.com/user-attachments/assets/4a14a2a6-07d9-466e-89af-7adc53b654d6

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

If the one-line install isn't available in your Claude Code, add the marketplace
first:

```
/plugin marketplace add Eleven-Estudio/claude-pinboard
/plugin install pinboard@eleven-estudio
```

### Update and uninstall

```
claude plugin update pinboard
claude plugin uninstall pinboard
```

After an update, run `/reload-plugins` or restart Claude Code to load the new
version.

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

## What it hooks

pinboard never rewrites a message, never runs a shell command or program, and
opens no network connection of its own. Its one model request, the optional
title above, goes through your own Claude Code session.

| Hook | What it does |
|---|---|
| `session.start` | Registers `/pin`, `/pins`, `/unpin` and the `pin`, `list_pins`, `unpin` tools. Loads your boards, and deletes session boards untouched for 90 days. |
| `session.end` | After `/clear` or a resume, drops the old session's pins from the pane. They stay in the store with that session. |
| `prompt.submit` | Loads the boards of the session in force if they are not loaded yet. Never changes your prompt. |
| `command.run` `pin` | Pins Claude's last reply, to the session board or, with `project`, the project's. |
| `command.run` `pins` | Shows the pane. |
| `command.run` `unpin` | Removes one pin or a whole board. |
| `tool.call` `pin` | Pins the text Claude gives it, when you ask Claude to pin something. |
| `tool.call` `list_pins` | Returns your pins to Claude, when it calls the tool. |
| `tool.call` `unpin` | Removes pins when Claude calls it. |
| `ui.render` `Pane` | Draws the pane and handles ticks, folds and the `x`. |
| `ui.render` `AssistantMessage` | Draws the engine's own block, unchanged, and adds the hover pin control over it. |

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

## Alternatives

[pin-memo](https://github.com/YeonwooSung/my-claude-code-mods/tree/main/pin-memo): a one-line band above the prompt for notes you type; it also uses /pin, so install one or the other.

## Development

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

See [CONTRIBUTING](CONTRIBUTING.md) for the typecheck and commit style.

## License

[MIT](LICENSE)

---

Made by [Geovanny Gil](https://github.com/GeovannyGil) at [Eleven Estudio](https://elevenestudio.com).
