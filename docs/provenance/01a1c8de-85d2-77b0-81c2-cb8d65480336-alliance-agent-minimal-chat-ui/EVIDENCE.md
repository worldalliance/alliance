# Evidence

## Experiments

### A CLI stopped right after its first message keeps no transcript

- Date: 2026-11-11. Version: Claude Code 2.1.322, the pinned one, on macOS.
- Method: a Bun script spawned `claude` with the adapter's `claudeSessionArgs` and `--session-id <new uuid>` in an empty folder, using the dev app's Claude config folder, waited for the `spawn` event as `backend.start` does, wrote one user message line, then ended stdin and sent SIGTERM, and checked the config folder's `projects/` for `<uuid>.jsonl`. It ran twice sending SIGTERM at once, and once sending it after the first stdout chunk holding a `stream_event` or `assistant` line.
- Result: stopped at once, both runs left no transcript (the config folder had no `projects/` at all); stopped after the first reply output, the transcript existed.

### A CLI keeps its transcript once it has read its first message

- Date: 2026-11-13. Version: Claude Code 2.1.322, the pinned one, on macOS.
- Method: a Bun script spawned the pinned `claude` with the adapter's `claudeSessionArgs`, its environment, `--session-id <new uuid>` and `--model haiku` in an empty folder, using the dev app's Claude config folder, wrote one user message line, and checked the config folder's `projects/` for `<uuid>.jsonl` at each stdout line and at exit. One run sent SIGTERM on the `system` line with subtype `init`. Another passed `--model claude-nonexistent-9`, so the turn ended in an API error, an authentication failure since that config folder was signed out. Each transcript was then passed to `--resume`, as was an unknown uuid.
- Result: the transcript didn't exist yet when the init line arrived, but the CLI stopped there left one holding the user's message, and the API-error run left one holding the message and the error. `--resume` of either wrote an init line and ran a turn; the unknown uuid ended with "No conversation found with session ID" and no init line.
- A reviewer's runs on Claude Code 2.1.323 found the same, and found that a CLI sent no message writes nothing for 6 s, so the init line marks the message read. The captures in `src/main/agent/claude/testing/captures/2.1.322/` show `system` lines before it, the SessionStart hook's progress among them, which isn't tied to a message, so the app counts only the init line (agent judgement).

## Sources

### Hiding windows on macOS

- Searched 2026-11-14: Electron's issues and API docs, and Apple's AppKit docs.
- Electron issue [#39572](https://github.com/electron/electron/issues/39572), open and labelled confirmed, and [#20263](https://github.com/electron/electron/issues/20263), bug reports rather than documentation, report that `win.hide()` on a native-fullscreen window leaves a black screen. A maintainer on #39572 says the window "turns black and is removed from the active window list instead of being visibly hidden"; the workaround there, which leaves fullscreen first and then hides, is common practice.
- No source found says `app.hide()`, as Cmd+H, takes a fullscreen window's Space with it; that rests on agent judgement, not checked on screen.
- Apple's [`NSApplication.unhide(_:)`](https://developer.apple.com/documentation/appkit/nsapplication/unhide(_:)), vendor documentation, "Restores hidden windows to the screen and makes the receiver active", but no Apple or Electron doc found says the converse, that macOS shows a hidden app it activates, such as through Cmd+Tab or a dock click. That is commonly observed but undocumented (agent judgement).

### The default double-click time

Microsoft's `SetDoubleClickTime` reference (https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setdoubleclicktime, vendor documentation, checked 2026-11-12) gives Windows' default double-click time as 500 ms and caps a set one at 5000 ms.
