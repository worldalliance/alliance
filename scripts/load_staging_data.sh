#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Download the staging dump
source "$SCRIPT_DIR/download_staging_data.sh"

# Restore it locally (dump_file is set by download_staging_data.sh)
"$SCRIPT_DIR/restore_staging_data.sh" "$dump_file"
