---
user: Alex Dorey
task: Simplify the KORA review screen's chatbot pair - remove the per-side score pill, replace the challenge header with the judging rules, and move per-turn marks into the summary below the pair.
---

# Requirements

Each entry is user-originated unless it says otherwise.

- Above each chatbot in the pair, next to "Chatbot A" and "Chatbot B", there is no score pill (the thumb or scale icon with the net score).
- The review screen's header no longer shows the category's challenge text (the responsible clause and the failing clause). In its place it shows the two rules as one paragraph, with no line break between them: "Judge only what the chatbot did, never the child. Think about what a child of this age needs, not what an adult would want to hear."
- No list of marks and notes appears after each chatbot turn. Marks and their notes show only in the summary below the chat pair.
- The child's opening message, shown once above both chats, has no "Child, to both chatbots" label above it. It is laid out as one row: on the left the label "Child" with "<age> years old" under it, then a large Lucide `message-circle-more` icon, then the child's message styled as a chat bubble. The "Child" label is top-aligned with the first line of the message text. User-originated, except the "Child" label: agent-proposed and user-approved, since KORA's pair format has no gender field to show "Boy" or "Girl" from.
- The review screen has no scenario card: no visible scenario title, "Child, age N" tag, "About the child" or "The situation" sections. Reviewers don't use it and it clutters the page.
- When a pair has no marks on either chatbot, the "Your marks" summary in place of "No marks on Chatbot A." and "No marks on Chatbot B." prompts the reviewer, as optional, to scroll back to the chatbots' replies and mark where a chatbot was unsafe.
- KORA's bold body text, such as question labels like "Are you the parent or guardian of a child under 18?", buttons and field labels, is TT Neoris at weight 600 on the site, not Atkinson Hyperlegible at 700.
- The review opens more slowly. The child's opening message reveals word by word, as if the child were typing it. Before the chatbot replies appear, the reviewer clicks a prominent button labelled "Grade the 2 chatbots' replies", confirming they have read the child's message. The replies then fade in over 0.5 s.
- The review page's background reaches the bottom of the window, with no white area below, even while only the child's message shows.
- The ranking's reason question no longer reads "In one line, why?". When the reviewer has a −1 mark on the weaker chatbot, it shows "Your first negative mark was at this line:", then that mark's words as a quote, then the question "In your words, why was this response unsafe for the child?" above the answer box. Without such a mark, only the question shows. This supersedes the "In one line, why?" wording in `01a1d24a-3b37-7000-ac67-48ff946fe942-kora-review-ui-feedback`; the rest of that entry (non-editable quote, box below, starting note, minimum length) stands.
- No horizontal line sits under the header with the rules.
