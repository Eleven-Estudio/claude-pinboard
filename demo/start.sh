#!/usr/bin/env bash
# Starts a clean Claude Code session for recording the pinboard demo.
#
# Nothing of your own setup shows up: the session uses its own config
# directory (settings, CLAUDE.md, plugins, MCP servers, history, login),
# runs in a throwaway copy of the demo project in your temp folder, and loads
# pinboard from this checkout.
#
#   demo/start.sh              fresh project, new session
#   demo/start.sh --continue   resume the last demo session (pins come back)
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/.." && pwd)"
config="${PINBOARD_DEMO_CONFIG:-$HOME/.pinboard-demo/config}"
# A folder of your own in the temp directory (per user on macOS), never a path
# another user could have made first.
base="${TMPDIR:-/tmp}"
base="${base%/}"
workdir="$base/pinboard-demo-$(id -u)"
project="$workdir/corner-coffee"

if ! command -v claude >/dev/null; then
  echo "Claude Code is not installed: https://code.claude.com/docs/en/setup" >&2
  exit 1
fi

# Refuses a workdir that is a symlink, belongs to someone else or was not made
# by this script, before anything is removed or written in it.
check_workdir() {
  if [[ -L "$workdir" || ! -d "$workdir" || ! -O "$workdir" || -L "$workdir/.pinboard-demo" || ! -f "$workdir/.pinboard-demo" ]]; then
    echo "$workdir is not a folder this script made for you; remove it first." >&2
    exit 1
  fi
}

if [[ "${1:-}" == "--continue" ]]; then
  if [[ ! -e "$workdir" && ! -L "$workdir" ]]; then
    echo "There is no demo session to continue; run demo/start.sh without --continue." >&2
    exit 1
  fi
  check_workdir
else
  # A new copy of the project.
  if [[ -e "$workdir" || -L "$workdir" ]]; then
    check_workdir
    rm -rf "$workdir"
  fi
  mkdir -m 700 "$workdir"
  touch "$workdir/.pinboard-demo"
  mkdir "$project"
  cp -R "$here/project/." "$project/"
  git -C "$project" init -q
  git -C "$project" add .
  git -C "$project" -c user.name=demo -c user.email=demo@example.com commit -qm "Corner Coffee checkout"
fi

mkdir -p "$config"
if [[ ! -f "$config/settings.json" ]]; then
  cat >"$config/settings.json" <<'JSON'
{
  "spinnerTipsEnabled": false,
  "permissions": {
    "allow": ["Bash(npm test:*)", "Bash(node --test:*)", "Bash(node cli.js:*)"]
  }
}
JSON
fi

export CLAUDE_CONFIG_DIR="$config"
export CLAUDE_CODE_HIDE_CWD=1
export CLAUDE_CODE_NO_FLICKER=1
export CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1
export DISABLE_AUTOUPDATER=1

cd "$project"
exec claude --setting-sources user --plugin-dir "$repo" --permission-mode acceptEdits "$@"
