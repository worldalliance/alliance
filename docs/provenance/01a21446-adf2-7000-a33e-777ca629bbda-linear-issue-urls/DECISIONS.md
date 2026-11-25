# Decisions

- The URL form is `https://linear.app/worldalliance/issue/ALL-XXXX`, the workspace slug existing links in the repository use; Linear resolves it without the title slug, so agents need no API call to build it. (agent decision)
- The `Fixes ALL-XXXX` and `Part of ALL-XXXX` lines that link a PR or commit stay bare keys, since the GitHub integration matches that text and a markdown link around the key is untested there; the link goes elsewhere in the text. Commit messages, which render no markdown, keep bare keys. (agent decision)
- The skill's `description` and its root `AGENTS.md` pointer now also trigger on naming an issue in chat, because the rule fires only if an agent mentioning an issue reads the skill. (agent decision)
