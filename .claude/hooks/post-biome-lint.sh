#!/usr/bin/env bash
# PostToolUse hook: auto-fix with biome, then report remaining violations.
# Must always exit 0. Non-zero = "hook error" in Claude Code.

input="$(cat)"
file="$(jq -r '.tool_input.file_path // .tool_input.filePath // empty' <<< "$input" 2>/dev/null)"

# Only process TS/JS files
case "$file" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

[ -f "$file" ] || exit 0

# Auto-fix first
npx biome check --fix --unsafe "$file" >/dev/null 2>&1 || true

# Check for remaining violations
diag="$(npx biome lint "$file" 2>&1)" || true

if echo "$diag" | grep -q "Found [1-9]"; then
  errors="$(echo "$diag" | grep -B2 "×" | head -20)"
  if [ -n "$errors" ]; then
    jq -n --arg m "$errors" '{"hookSpecificOutput":{"hookEventName":"PostToolUse","additionalContext":$m}}' 2>/dev/null
  fi
fi

exit 0
