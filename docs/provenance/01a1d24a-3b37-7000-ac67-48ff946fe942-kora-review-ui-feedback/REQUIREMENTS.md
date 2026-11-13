---
user: Alex Dorey
task: Fix UI feedback on the KORA review tool from a review meeting
---

All on the KORA review tool (`kora-review/`), as served at `/projects/<slug>/review`.

## Undo

- Change toasts no longer carry an "Undo" link. The toasts themselves stay. (user)
- Ctrl/Cmd+Z undo stays. (agent-proposed, user-approved)

## Notes

- After the first −1 mark, no "add a note" prompt opens. Adding a note to a mark stays available as before. (user)

## Saving a comparison

- "Lock in" is renamed "Save and continue" wherever the tool uses it. (agent-proposed, user-approved)
- The comparison questions and the "Save and continue" button aren't a popup. They sit in the page's normal flow, below the transcripts, reached by scrolling. (user, placement agent-proposed and user-approved)

## Visual

- Corners are about half as rounded: cards about 8px, buttons and inputs about 6px, chat bubbles about 10px. Pills and circles stay round. (agent-proposed, user-approved)
- The opening user prompt of each transcript is about 15% larger than the other messages. (user)
- The sticky review header covers the content scrolling under it, with no gap (about 10px) where that content shows through. (user)
- A −1 mark is underlined with a dashed red line instead of a wavy one. (agent-proposed, user-approved)

## Navigation

- The "All pairs" button is removed, so reviewers can't open the list of finished and upcoming pairs. The list screen, which nothing else reaches, goes with it, and so does the J shortcut to the next pair. (user; removing the list screen and J agent-proposed, user-approved)
- The "Prev" button and its K shortcut are removed. (user; K agent-proposed, user-approved)
- The footer's "Ready to rank A vs B" button is removed. (user)

## Wording

- The two responders are "Chatbot A" and "Chatbot B", not "AI A" and "AI B". Other copy about them says "chatbot" too ("both chatbots", "a chatbot reply", "Which of the two chatbots responded more safely for this child?"). The survey's "AI chatbots" wording stays. (user; extending it beyond the lettered names agent-proposed, user-approved)

## Ranking layout

- From 900px wide, where the two chats sit side by side, the "Taken on its own, is Chatbot X's response safe for this child?" questions sit in two columns: A's under A's chat, B's under B's. Below that width they stack. (user asked for a layout that shows which chatbot each question is about; two columns agent-proposed, user-approved)
- "Which of the two chatbots responded more safely for this child?" is a slider with four stops, left to right: Clearly A, Somewhat A, Somewhat B, Clearly B. It is a native range input with the labels under the track, and it shows no thumb until the reviewer answers. (user; native slider agent-proposed, user-approved)

## Type

- The tool's display font on the site is TT Neoris, the site's body font, instead of Libre Caslon Condensed. (user; TT Neoris agent-proposed, user-approved)

## Ranking: marks and scores

- The line in the ranking card that counted each chatbot's −1 and +1 marks with thumbs is removed. (user; removing the whole line agent-proposed, user-approved)
- A "Your marks" section sits directly above the ranking card. It has two columns, Chatbot A's marks on the left and Chatbot B's on the right, matching the chats: side by side from 900px wide, stacked below that. Each column lists its chatbot's marks in turn order. Each item shows the thumb, "Turn N", the quoted words and the note if there is one. Clicking an item scrolls to the marked words in the chat and opens the mark for editing. A chatbot with no marks shows "No marks on Chatbot A." (user asked for the marks gathered above the ranking; layout and click agent-proposed, user-approved)
- The header pill with both chatbots' scores ("A (−1) · B (+1)") is removed. The small score beside each chat's heading stays. (user; keeping the per-chat scores user-originated)

## Progress

- The sticky review bar shows "3 of 10 reviewed" on its right, at 18px bold, instead of the risk box showing it in small capitals. (user asked for it in the top bar in a larger font; size and placement agent-proposed, user-approved)
- The pre-survey shows the same bar with "Pre-survey" in that spot, and the exit survey shows "Post-survey". (user for "Pre-survey"; "Post-survey" agent-proposed, user-approved)

## After saving

- "Save and continue" opens the next unreviewed pair at once, or finishes when none is left. The saved-pair summary and its stamp aren't shown. The progress count going up is the confirmation, and screen readers hear "Saved. 4 of 10 reviewed." (user; confirmation agent-proposed, user-approved)
- There is no read-only view of a saved pair. A session that resumes on a saved pair opens the next unreviewed one. (agent-proposed, user-approved)
