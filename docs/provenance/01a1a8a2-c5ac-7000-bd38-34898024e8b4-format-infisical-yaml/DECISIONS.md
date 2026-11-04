# Decisions

- **Leave `server/.infisical.yaml` at the Infisical CLI's 4-space indent and exclude it from Prettier.** `infisical init` writes that indent, and the [CLI project config](https://infisical.com/docs/cli/project-config) shows the same layout. Prettier's YAML indent is 2 spaces, so rewriting the file would diverge from the file the CLI emits and fail again the next time `infisical init` rewrites it. `.prettierignore` already skips generated files for that reason. Origin: agent decision.
