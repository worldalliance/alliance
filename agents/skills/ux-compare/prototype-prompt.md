# Prototype: {{ITEM}}, variant {{VARIANT}}

You are in a throwaway worktree, `{{WORKTREE}}`. Read its `.worktree/AGENTS.md` first: it gives this worktree's ports, which differ from any checkout you may have seen. The work here is a prototype for the user to compare and is never pushed or merged. You are one step of a ux-compare run, so skip the `ux-compare` skill: it is the run's own procedure, not yours.

## The item

{{ITEM_DETAIL}}

## This variant

{{DIRECTION}}

Other variants of the same item take other directions; follow this one, even where another seems better.

## Build

Make the change in the app, as real working code that follows the repository's `AGENTS.md` and `agents/skills/ux-guidelines/SKILL.md`, scoped to this item alone. Typecheck the packages you touched. Commit it on this worktree's branch; the root `AGENTS.md` rule to ask before git writes doesn't apply to this commit, which the user approved.

## Capture

This worktree's database is a copy of the main checkout's, so run `bun run migration:run` in `server/` first. Start what the surface needs in this worktree and run `{{RUN}}/capture.mts` as `{{RUN}}/context.md` describes, from this worktree's root so it seeds and captures this worktree alone, with `{{RUN}}/prototypes/{{ITEM_SLUG}}/{{VARIANT}}/` as the output directory. Where the change breaks a step of the script, adapt a copy of it and say so in your report. Stop the processes you started, by PID.

## Report

Your final message: what you changed (files and a sentence each), anything about the variant that the screenshots don't show, and any state you couldn't capture, with the reason.
