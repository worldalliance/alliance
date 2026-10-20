---
name: export-action
description: Export a platform action to YAML for rebuilding as an AllianceForm package
disable-model-invocation: true
---

# Export an action

`action-export` reads an action out of this checkout's dev database and writes
`.scratch/<id>-<slug>.yml`. It uses a script `export-action.ts`:

```bash
bun scripts/export-action.ts --repo . 157
```

!If scripts/export-action.ts does not exist, prompt the user with specifications and build
export-action.ts. Prompt the user with `ask_user_input_v0` or "AskUserInput". Then run the
command on the requested action.

Done when `check-jsonschema` passes and the `name` in the file is the action
that was asked for:

```bash
pipx run check-jsonschema --schemafile skills/export-action/action-export.schema.yml .scratch/157-*.yml
```

That second half is the real check. The local database is a staging copy, so an
id names whatever `scripts/load_staging_data.sh` last loaded. Action 153 is one
action locally and a different one in the `action-exports/` corpus.

## The form rendering

`action-export` owns the plain-text rendering of the task form, and
`action-exports/` is the corpus it matches. Hand-roll a renderer from the
grammar in `action-export.schema.yml` and it drifts somewhere silent. That
comment never says a `header` block renders bare, a `previousAnswer` block
renders its `title`, or the form string ends without a trailing newline. Fix
`action-export` and re-run it.
