# Decisions

- Paragraph breaks are `\n\n` in the copy string, and the hero note's `<p>` in `KoraHomeBase.tsx` uses `whitespace-pre-line`, so any hero note can carry breaks without markup in the copy. (agent decision)
- "pairs of conversations" keeps the "of" from the earlier wording, since `pairs(n)` already renders "{n} pairs". (agent proposal, user-approved)
