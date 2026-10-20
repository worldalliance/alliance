# Message timestamps show "now"

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The three copies came from the same author and are identical, so none differs on purpose; they share `formatMessageTime` in `shared/lib/messageTime.ts`.
- The formatter gets its own module rather than `shared/lib/utils.ts`, which holds generic helpers, or `shared/lib/conversations.ts`, whose test file is already past 500 lines.
