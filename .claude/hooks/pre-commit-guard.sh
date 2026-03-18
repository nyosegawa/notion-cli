#!/usr/bin/env bash
# PreToolUse hook: block --no-verify on git commit
input="$(cat)"
command="$(jq -r '.tool_input.command // empty' <<< "$input" 2>/dev/null)"

case "$command" in
  git\ commit*|git\ -c\ *commit*) ;;
  *) exit 0 ;;
esac

if echo "$command" | grep -q -- "--no-verify"; then
  echo "BLOCKED: --no-verify is prohibited (see AGENTS.md Rules)" >&2
  exit 2
fi
