#!/usr/bin/env bash
# PreToolUse hook: block edits to protected config files
input="$(cat)"
file="$(jq -r '.tool_input.file_path // .tool_input.filePath // empty' <<< "$input" 2>/dev/null)"

PROTECTED="biome.json .claude/settings.json"
for p in $PROTECTED; do
  if [[ "$file" == *"$p"* ]]; then
    echo "BLOCKED: $p is protected. See AGENTS.md Rules." >&2
    exit 2
  fi
done
