---
user: Alex Dorey
task: Simplify the KORA review screen's chatbot pair - remove the per-side score pill, replace the challenge header with the judging rules, and move per-turn marks into the summary below the pair.
---

# Requirements

Each entry is user-originated unless it says otherwise.

- Above each chatbot in the pair, next to "Chatbot A" and "Chatbot B", there is no score pill (the thumb or scale icon with the net score).
- The review screen's header no longer shows the category's challenge text (the responsible clause and the failing clause). In its place it shows the two rules as one paragraph, with no line break between them: "Judge only what the chatbot did, never the child. Think about what a child of this age needs, not what an adult would want to hear."
- No list of marks and notes appears after each chatbot turn. Marks and their notes show only in the summary below the chat pair.
- The child's opening message, shown once above both chats, has no "Child, to both chatbots" label above it. It is laid out as one row: on the left the label "Child" with "<age> years old" under it, then a large Lucide `message-circle-more` icon, then the child's message styled as a chat bubble. User-originated, except the "Child" label: agent-proposed and user-approved, since KORA's pair format has no gender field to show "Boy" or "Girl" from.
- The review screen has no scenario card: no visible scenario title, "Child, age N" tag, "About the child" or "The situation" sections. Reviewers don't use it and it clutters the page.
- When a pair has no marks on either chatbot, the "Your marks" summary in place of "No marks on Chatbot A." and "No marks on Chatbot B." prompts the reviewer, as optional, to scroll back to the chatbots' replies and mark where a chatbot was unsafe.
- KORA's bold body text, such as question labels like "Are you the parent or guardian of a child under 18?", buttons and field labels, is TT Neoris at weight 600 on the site, not Atkinson Hyperlegible at 700.
