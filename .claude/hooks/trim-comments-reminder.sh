#!/usr/bin/env bash
set -euo pipefail

input=$(cat)
tool=$(jq -r '.tool_name // ""' <<<"$input")

case "$tool" in
  Edit|Write|NotebookEdit)
    path=$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")
    case "$path" in
      *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.py|*.sh|*.sql|*.css|*.scss|*.ipynb) ;;
      *) exit 0 ;;
    esac
    ;;
  Bash)
    cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
    grep -Eq '(>>?[[:space:]]*[^|&[:space:]]|<<|[[:space:]]tee[[:space:]]|sed[[:space:]]+-[a-zA-Z]*i|perl[[:space:]]+-[a-zA-Z]*i|[[:space:]]patch[[:space:]])' <<<"$cmd" || exit 0
    ;;
  *)
    exit 0
    ;;
esac

jq -n '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: "Reminder: before presenting this change, apply skills/trim-comments/SKILL.md (and skills/keep-test.md) to every comment you're about to add. Default to no comments."
  }
}'
