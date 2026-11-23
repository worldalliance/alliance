# Decisions

## Scope

- This PR renames tasks to worktrees and makes "New worktree" name-only. Moving the archived flag into the scripts' record, which the user approved, is ALL-2407, a separate PR, because it changes the shared worktree scripts and their tests while this one stays inside `agents/desktop` (agent decision).
- The rename covers code as well as interface: types, files, IPC channels, CSS classes, test names, and the store file, now `worktrees.json` with a `worktrees` array (agent decision). The agent CLIs' own "task" words, such as Claude's Task tool in `src/main/agent/claude/protocol.ts`, the generated Codex protocol and the captures, stay, since they name the CLIs' things.
- The store file is renamed without migrating `tasks.json`, so titles and archived flags saved by earlier dev builds are dropped, and so is unsent text in a worktree's message box, whose local storage key moves from `task:` to `worktree:` (agent decision). The app is unpackaged (`package.json` version `0.0.0`) and saving tasks merged the day this task started, so only development builds have the file, and ALL-2407 removes the store.
- The script's row types in `src/main/worktrees/list.ts` are `ListedWorktree` and `ListedWorktreeState`, so the app's own `Worktree` and `WorktreeState` keep the plain names (agent decision).
