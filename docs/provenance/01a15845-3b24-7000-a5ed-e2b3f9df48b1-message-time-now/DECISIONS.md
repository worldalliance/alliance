# Message timestamps show "now"

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

- The three copies came from the same author and are identical, so none differs on purpose; they share `formatMessageTime` in `shared/lib/messageTime.ts`.
- The formatter gets its own module rather than `shared/lib/utils.ts`, which holds generic helpers, or `shared/lib/conversations.ts`, whose test file is already past 500 lines.
- "Now" is decided from the dates, not by replacing date-fns's "less than a minute ago": a message under 60 seconds old, or dated after the device clock, reads "now". Matching the library's wording broke silently if that wording changed, and date-fns rounds to the nearest minute, so 30 to 59 seconds read "1 minute ago" and a message from a server whose clock runs ahead read "in less than a minute" or "in 2 minutes". `formatNotificationTime` caps future notification times the same way; the cap stays out of `formatTime`, which also shows future event times.
