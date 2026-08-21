#!/usr/bin/env bash
# Database shell commands share the TypeScript guards' dotenv parser. Missing
# files and keys produce an empty string for the caller to handle.
_env_value_script="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/env-value.ts"

env_value() {
  local file="$1" key="$2"
  bun "$_env_value_script" "$file" "$key"
}
