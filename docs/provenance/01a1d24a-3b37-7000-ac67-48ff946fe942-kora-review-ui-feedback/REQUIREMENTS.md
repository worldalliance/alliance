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
