# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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

[0.5.0]: https://github.com/Eleven-Estudio/claude-pinboard/releases/tag/v0.5.0
