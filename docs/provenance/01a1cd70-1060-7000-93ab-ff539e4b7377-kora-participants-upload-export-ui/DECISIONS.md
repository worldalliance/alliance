# Decisions

- The file fields reuse the `file:` button styling `DeleteAccountModal.tsx` already gives its file input, adding a pointer cursor and hover fill. Agent decision: one look for file pickers across admin.
- Export stays a `<button>` styled as a link, since it downloads a generated file rather than navigating. Agent decision, per the ux-guidelines rule that actions are buttons.
- The control is a sibling of the `<h1>`, not inside it, so the heading's accessible name stays "Kora participants". The brackets are `aria-hidden`, so the button's name is "export csv". Agent decision.
- The label keeps the user's lowercase `export csv`, departing from the root `AGENTS.md` capitalisation rule ("Export CSV") because the user specified the exact text. Agent interpretation; the user may prefer the rule's casing.
- The format is read from the file's content, not its name: after leading whitespace and `#` comment lines, `[` means a JSON array, `{` means JSON Lines, and anything else is YAML. The server and `kora-review/scripts/kora-to-transcripts.mjs` both read through `readKoraPairs`, so neither needs the filename. Agent decision.
- YAML is parsed with the `yaml` package, declared in `kora-review/package.json`, rather than `Bun.YAML`, because `kora-review` is also bundled for the browser and `yaml` reports the line each pair starts on, which upload rejections show as "Line N". Agent decision.
- A file that can't be parsed is now reported as "couldn't be read: …" rather than "isn't valid JSON: …", since the parse error may be YAML's. Agent decision.
