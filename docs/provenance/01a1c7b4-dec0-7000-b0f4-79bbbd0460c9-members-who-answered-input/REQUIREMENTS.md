---
user: Alex Dorey
task: A form variable can show how many members have already submitted a photo, for the oat milk action's form ("So far, #{num_completions} members have already submitted a picture or video.").
---

# Members who answered

- A new variable input type counts the members whose latest submission to a chosen form answered a chosen question, and reads as a plain number. It works for any question outside a list, file uploads included. (agent-proposed, user-approved)
- It counts the way aggregate counts do: each member's latest submission, setting aside withdrawals; guests don't count. (agent-proposed, user-approved)
- It is a stored input kind of its own, so builds that predate it fail the variable instead of showing a wrong number. (agent-proposed, user-approved)
- The admin builder labels it "Members who answered"; its stored kind is `answeredCount`. (user-originated label; agent-proposed, user-approved id)
- The builder's sample number box, which only feeds the formula preview, has a visible label. Its text is "Preview with". (agent-proposed, user-approved; label text agent judgement)
