# Recording the demo

A clean, repeatable setup for recording pinboard without showing anything of your
own: `start.sh` runs Claude Code with its own config directory (no settings,
CLAUDE.md, plugins, MCP servers, history or sessions of yours), in a throwaway
copy of a tiny project under `/tmp`, with pinboard loaded from this checkout.

## Before you record

- Claude Code 2.1.319 or newer: mods need a recent build.
- A terminal with mouse support (Ghostty, iTerm2 or Terminal), at least 150
  columns wide so the pane docks on the right, and a large font (16–18 pt) so
  the GIF stays readable.

```sh
git clone https://github.com/Eleven-Estudio/claude-pinboard
cd claude-pinboard
demo/start.sh
```

The first run in the demo config asks you to log in and to trust the folder: do
it off camera. The welcome screen can show your account, and `/status` shows
your email and organization, so keep both out of the recording. If you log in
with a claude.ai account, its connectors may still load; just don't open them.

Do one rehearsal with [SCRIPT.md](SCRIPT.md), then `/unpin all`, `/exit`, and
start again with `demo/start.sh` for the take.

## Record and convert

1. **⌘⇧5 → Record Selected Portion**, framed on the terminal. Leave out the
   top rows if they show your account.
2. Convert the `.mov` to a GIF under 10 MB:

```sh
brew install ffmpeg
ffmpeg -i demo.mov -vf "fps=12,scale=1200:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" docs/demo.gif
```

GitHub also plays an `.mp4` dragged into the README in its web editor, if the GIF
comes out too large.

## Clean up

`rm -rf ~/.pinboard-demo /tmp/pinboard-demo` removes the demo config (and its
login) and the project copy.
