# Decisions

- The file fields reuse the `file:` button styling `DeleteAccountModal.tsx` already gives its file input, adding a pointer cursor and hover fill. Agent decision: one look for file pickers across admin.
- Export stays a `<button>` styled as a link, since it downloads a generated file rather than navigating. Agent decision, per the ux-guidelines rule that actions are buttons.
- The control is a sibling of the `<h1>`, not inside it, so the heading's accessible name stays "Kora participants". The brackets are `aria-hidden`, so the button's name is "export csv". Agent decision.
- The label keeps the user's lowercase `export csv`, departing from the root `AGENTS.md` capitalisation rule ("Export CSV") because the user specified the exact text. Agent interpretation; the user may prefer the rule's casing.
