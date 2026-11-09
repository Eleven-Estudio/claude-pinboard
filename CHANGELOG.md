# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.6.1] - 2026-11-09

### Fixed

- `/pin` on a reply made of several blocks now keeps its `↑`: the block that
  opens the reply is found, not only a reply of a single block.
- Pinning while the pane is minimized gives one notice, not a toast and a text.
- Ticking a checkbox after the pin changed no longer flips a line inside a code
  block, and with repeated lines it flips the one nearest the one you pressed.
- Minimizing or restoring the pane sets the fold only after the pane has closed
  or opened, and a failure shows a message instead of being dropped.
- `/clear` and resuming unfold the pane, as a new session starts unfolded.

## [0.6.0] - 2026-11-09

### Added

- A `↑` on each pin that scrolls the conversation back to the reply it came
  from: the block you pinned, the reply `/pin` took, or the moment Claude pinned
  it. When that reply is gone, you get a short message instead.
- Minimize: the `–` at the top of the pane, its close mark (ctrl+x x) and `/pins`
  fold the pane to one line above the prompt with the pin count and the open
  pin. Click the line, or run `/pins`, to bring the pane back.

### Changed

- `/pins` folds the pane when it is up and shows it when it is not.
- While minimized, a new pin leaves the pane closed and says so with a toast.

## [0.5.0] - 2026-11-09

First public release.

### Added

- A side pane next to the chat that keeps pinned notes and checklists in view.
- `/pin`, `/pins` and `/unpin` commands, and a hover `pin` / `pin project`
  control under each block of Claude's reply.
- Two boards: a session board that comes back when the session is resumed, and
  a project board shared by every session in the same folder.
- Markdown task lines (`- [ ] item`) drawn as checkboxes you tick in the pane,
  with progress on each folded card.
- `pin`, `list_pins` and `unpin` tools, so Claude can pin a note and read the
  pins back.
- Short titles for pinned replies, asked of `haiku` through your own session,
  with a title from the first heading or line as the fallback.
- Limits of 50 pins per board and 20,000 characters per pin.

### Changed

- Every change is written to disk before it shows in the pane. If the write
  fails, nothing changes and the command, tool or press reports the error.

[0.6.1]: https://github.com/Eleven-Estudio/claude-pinboard/releases/tag/v0.6.1
[0.6.0]: https://github.com/Eleven-Estudio/claude-pinboard/releases/tag/v0.6.0
[0.5.0]: https://github.com/Eleven-Estudio/claude-pinboard/releases/tag/v0.5.0
