# Decisions

- The extra space sits above every message that starts a group (`isFirstInGroup`): a change of author, or the same author posting more than 3 hours after their previous message. Those are the points where the name, avatar and time header reappears, and a header with no space above it reads as cramped. Limiting the space to author changes would leave a repeated same-author header without it. (agent decision)
- The space is 12px (`pt-3`), one step on the 4px spacing scale, as "slightly more" space between authors. (agent decision)
- The focus highlight (`bg-green-100`) moves from the bubble's outer view to its inner view, so the new space above a group stays uncoloured when the message is focused. (agent decision)
- The message list drops its 12px top padding because the first message always starts a group and now carries 12px above it, which keeps the inset above the oldest message at 12px instead of 24px. (agent decision)
