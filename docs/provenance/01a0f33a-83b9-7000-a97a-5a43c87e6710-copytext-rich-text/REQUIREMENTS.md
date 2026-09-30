---
user: Charles Lien
task: Rich text copying for the copy text form element
---

- The user asked whether the copy text display block could copy rich text, and how it should be configured.
- The agent proposed an opt-in, per-block "Rich text" toggle (existing blocks stay plain); when on, `text` is authored as markdown, rendered as markdown, and copied as both `text/html` and a plain-text fallback with the markdown syntax stripped. The user approved the proposal ("yes").
- Rich copying ships on both web and mobile in the same change.
