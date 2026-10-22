---
user: markzxu
task: Fix "like" notifications rendering with an extra space when a member's name has a stored trailing/leading space
---

- User asked: "do some mebers have a space after their username" — prompted by an earlier question about whether "like" notifications have an extra space in them.
- Agent (this session) found that `User.name` has no trim on write, and 29 dev-DB rows have leading/trailing/doubled internal spaces, which render verbatim into notification text (e.g. "Ada Lovelace liked your post").
- Agent proposed: "Want me to fix it by adding `@Transform(trim)` to `name` in the DTO (and optionally a migration to clean up existing rows?"
- User said: "do it, then make a pr" — approving the fix and a PR.
