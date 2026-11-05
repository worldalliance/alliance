---
name: ux-compare
description: Read before comparing an Alliance surface's UI or UX with established products, or prototyping alternatives to it.
---

# UX comparison

One run takes one surface or flow (the desktop app's chat view, New task, member onboarding, an admin list) from screenshots to ranked items and runnable prototypes. It suggests and prototypes; it changes nothing on the user's branch.

Work from the repo root of a checkout `scripts/new-worktree.sh` created, or the main checkout. Each run lives in `.scratch/ux-compare/<run-name>/`, where `<run-name>` is `<surface-slug>-<YYYYMMDD>`, with `-2`, `-3`, … appended when that directory or any `.scratch/<run-name>-*` file exists, or when `git worktree list` shows a worktree whose name contains `uxp-<run-name>-`, since another checkout or an earlier run may have left one. `<run>` below is that directory's absolute path, and `{{RUN}}` in the templates is filled with it, since builders work from other worktrees. Spawn every agent per `agents/skills/subagents/SKILL.md`, with prompts filled in from the templates beside this file, and start every subagent name with `<run-name>-`, so no file is left over from an earlier run.

## 1. Scope

Settle with the user which surface, which of its states to capture (the normal state, plus empty, loading, error and any other state the flow has), and three to five established products that have a comparable surface; propose the products. Ask where the reference screenshots come from:

- captured live where possible (Playwright for web apps, screen capture for installed desktop apps), with official screenshots and docs from web search as the fallback;
- web search only;
- supplied by the user.

Done when the surface, its states, the products and the source are agreed.

## 2. Capture

- Capture ours from committed code, since step 5's prototype worktrees start from this checkout's last commit and would otherwise lack what ours shows. When `git status` shows uncommitted changes to the surface, ask the user to commit them before capturing.
- `<run>/ours/<state>.png`: this checkout's running app, per `agents/skills/playwright/SKILL.md`, at one viewport for every capture, recorded in `context.md`. Write the capture as a script, `<run>/capture.mts`, that seeds synthetic data for each state, drives the app into it and saves its screenshot, so a prototype builder reproduces the same states in its own worktree. Ours and each prototype capture from different databases, so every state shows only records the script creates, by scoping to an account or record of its own; an empty list, too, comes from that scoping, since the script only adds rows and so never deletes data in the checkout's database. `context.md` names any state the surface can't scope that way. Every account and record it creates carries a suffix unique to that run of the script, such as a timestamp, so it runs again in the same checkout and in a worktree whose database copies one it already seeded; the suffix goes in emails and other fields the screenshots don't show, and in a name they show only where that name must be unique. It runs under Node 22.18 or later, which strips its types, so it uses only erasable syntax, such as a string-literal union where the repo would use an enum, and `import type` for type-only imports, which Node otherwise keeps and fails to load. It runs from the root of the checkout it captures, takes only an output directory as its argument, and reads everything checkout-specific relative to that working directory: ports from `bun scripts/ports.ts <server|frontend|admin>`, the database connection settings (`DB_*`) and `JWT_SECRET` from `server/.env`, and the desktop app from `agents/desktop/`. It names no port, database or path of any checkout, so run from a builder's worktree it seeds and captures that worktree alone.
- For a desktop-app surface, read `desktop-capture.md` before writing `capture.mts`.
- `<run>/refs/<product>/<state>.png`: from the agreed source. A product the user must sign in to waits for them to sign in. Crop or blur personal information from captures of their accounts.
- `<run>/context.md`: the surface and its states, the viewport, who uses it, the product requirements that constrain it (from its `docs/provenance/` entries and `AGENTS.md` files), the source files that implement it, how to run `capture.mts`, its setup steps included, and for each reference image where it came from. Facts only: the judges read it, and an impression of yours in it would reach all four.

Done when every agreed state has a capture of ours, every product has what the source yields, and `context.md` names any gap.

## 3. Judge

Fill `judge-prompt.md` once into `<run>/judge-prompt.md`, with `{{SURFACE}}` the surface's name; all four judges get that same file and nothing else, so each review is independent of the others and of you. Run two Claude judges and two Codex judges in parallel, labelled `claude-1`, `claude-2`, `codex-1`, `codex-2`, each subagent named `<run-name>-<label>`. Run Codex with `-s read-only` in place of `--dangerously-bypass-approvals-and-sandbox` and every PNG under `<run>` attached, one `-i` per file. Rerun a judge that fails under a new subagent name, such as `<run-name>-<label>-retry`; a second failure goes to the user with its log. Once all four have succeeded, retries included, and not before, since judges explore `<run>`, save each judge's final message to `<run>/judges/<label>.md`.

Once all four judge files exist, fill `merge-prompt.md` the same way and run one fresh Claude agent with it; save its answer to `<run>/ranked.md`.

Done when four judge files and `ranked.md` exist.

## 4. Choose

Show the user the ranked items, one line each with its agreement count, and ask which to prototype. Each run asks.

Done when the user has named the items to prototype, or none; with none, go to step 6.

## 5. Prototype

For each chosen item, pick two or three directions from `ranked.md` that differ in approach, not in polish. For each direction, `scripts/new-worktree.sh uxp-<run-name>-<item-slug>-<variant>` from this checkout, keeping the name under 50 characters since it names the worktree's databases. Fill `prototype-prompt.md` with `{{ITEM}}` the item's title, `{{ITEM_DETAIL}}` its section of `ranked.md` verbatim, `{{DIRECTION}}` this direction, `{{WORKTREE}}` the worktree's name, and `{{ITEM_SLUG}}` and `{{VARIANT}}` the parts of that name, and run the builder from that worktree's root, so its prompt and the files the subagents skill writes, its result included, are in that worktree's `.scratch/`; alternate Claude and Codex builders across variants. Run a handful at a time. The root `AGENTS.md` rule to ask before git writes doesn't apply to these worktrees or to the builders' commits in them, since the user's choice in step 4 approves them.

Done when every variant has its screenshots under `<run>/prototypes/<item-slug>/<variant>/` or a stated reason it has none.

## 6. Report

Write `<run>/report.md`, with images linked relatively so it renders in place. For each item in rank order: the problem in a sentence, ours beside the reference products for the states it concerns, the judges' basis and agreement, and each variant's screenshots with its direction, worktree name and builder's notes, saying of any state `context.md` names as unscoped that its data differs between ours and the variant. Items not prototyped follow, each with its basis, agreement and directions from `ranked.md`. Then what the surface already does well.

End the report with the `scripts/rm-worktree.sh <name>` command for each prototype worktree.

Done when the report renders with every image and each variant names its worktree. Hand the user the report's path.
