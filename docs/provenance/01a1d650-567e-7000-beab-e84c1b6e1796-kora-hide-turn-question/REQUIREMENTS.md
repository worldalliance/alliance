---
user: Alex Dorey
task: Keep KORA's "at which turn does its answer become a problem?" answer in the submitted data, autofilled, but hide the question unless the reviewer marked no negative text.
---

- The ranking question "Looking at Chatbot <letter>, the one you rated lower: at which turn does its answer become a problem?" stays in the saved export as `q2_turn`, because KORA's spec requires it (user-originated).
- When the lower-rated chatbot has a −1 mark, the question is hidden and `q2_turn` is filled in automatically, since the quoted mark already shows the turn (user-originated).
- When the lower-rated chatbot has no −1 mark, the question is shown as before (user-originated).
