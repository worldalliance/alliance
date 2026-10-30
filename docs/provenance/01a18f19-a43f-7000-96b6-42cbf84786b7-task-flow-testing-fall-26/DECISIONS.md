## Decisions

- **TN-25: one screen per page, aligned by index.** `buildFlowScreens` maps every page to a screen, empty pages included, so a screen's index is its page's index. An empty page never shows because `visibleFlowScreenIndices` skips screens with nothing visible.
- **TN-25: the first header block anywhere on the page is the title.** It's lifted out of the page's content, even when content comes before it, so an author's title never shows twice. The authoring guide asks for it at the top of the page.
- **TN-25: saved screens restart.** Saved positions were screen indices under the old splitting, which now point at different pages. The storage key moved from `taskflow-screen:` to `taskflow-step:`, so a member's saved position from before resumes by page from their draft instead of landing on the wrong page.
