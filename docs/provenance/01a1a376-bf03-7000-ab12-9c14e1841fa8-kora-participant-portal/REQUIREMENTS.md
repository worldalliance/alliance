---
user: Alex Dorey
task: Portal for signed-in Kora participants on the Safer Chatbots for Children page
---

# Requirements

The page is `/projects/safer-chatbots-for-children` in `apps/frontend`. A Kora participant is someone signed in through the page's own sign-up (`/kora/*`), not an Alliance member.

## Portal card

- For a signed-in Kora participant, the hero's "You’re signed in as {name}." line is replaced by a landing card that explains the chatbot ranking experience and serves as the portal into it. Origin: user.
- Only the hero changes. The page stays at the same URL, and the sections below the hero (participant bar, timeline, about sections, news) stay as they are. Origin: agent-proposed, user-approved.
- The card's copy, in order. Origin: agent-proposed, user-approved.
  - Heading: `Hi {name}`, with the existing sign-out icon button beside it.
  - Numbered steps:
    1. `Read two AI chats with the same child.`
    2. `Tap or drag across words, mark them +1 or −1, with an optional note.`
    3. `Say which AI was safer, then lock in.`
  - `It takes about an hour, at your own pace.`
  - A disabled primary button: `Start reviewing — opens November 17`.
- The button stays disabled and leads nowhere. Connecting it to the review tool is a separate, later task. Origin: agent-proposed, user-approved.

## Demo video

- For a signed-in participant, the hero's right-hand image collage is replaced by a looping demo of the review tool, made from the recording `chatbot-ranking-tool.mov`. The recording shows someone selecting a span of an AI reply, adding a note and marking it −1. Origin: user supplied the recording; placement agent-proposed, user-approved.
- The recording is used as it is, even though its example is a homework chat and not a child-safety pair. It can be swapped out later by replacing the file. Origin: agent-proposed, user-approved.
- The video autoplays muted, loops, plays inline and has no controls. When `prefers-reduced-motion` is set, it shows its poster frame with a play button instead of autoplaying. Origin: agent-proposed, user-approved.

## Unchanged

- The page stays the same for signed-out visitors and signed-in Alliance members, and during the sign-up steps (contact, code, name). Origin: agent-proposed; the user left it in place.

## References

- The review tool's behavior is described in `TRANSCRIPT_REVIEW_TOOL_SPEC.md`, and its prototype is `transcript-review.html` (both untracked at the repo root). The card's steps summarize the prototype's welcome steps.
