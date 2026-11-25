---
user: Alex Dorey
task: Spec a new "conversational" question type for the Alliance task form, in which an expert asks the member a select-one question in chat bubbles and replies to the member's choice.
---

# Requirements

## The question type

- A new question type for task forms that makes the form feel conversational. It is one form question made of, in order: (user-originated)
  1. A chat bubble from an expert, left-aligned, with the expert's avatar beside it, holding markdown-formatted text.
  2. The member's response: a select-one question whose options sit in a right-aligned chat bubble.
  3. An optional reply from the expert, shown when the member selects an option the admin gave a reply. Each option has its own reply or none.
  4. An optional note box at the end, where the member can write a note.

  Example: Dr Maria writes "Please consider the following: [a bullet list of statements]. Were you aware of these statements?" The member's options are "Yes, I was aware of these statements, and I accept them as true", "Yes, I was aware of these statements, but I am not convinced they are true" and "No, I was not aware of these statements". Choosing the second gets the reply "Interesting. Please leave a note about your skepticism and I will be sure to read it"; choosing the third gets "Thank you for your reply"; choosing the first gets no reply.
- The expert asks one markdown message before the member's options, however long it needs to be. Several expert messages before the options are out of scope. (agent-proposed, user-approved)

## The expert

- The admin picks the expert from Alliance users, as the Quote block does: searching users by name or id, and showing that user's name and profile picture. The expert needs an Alliance account. (agent-proposed, user-approved)
- The expert's avatar sits beside each expert bubble, and the expert's name shows above the first expert bubble, as chat apps do. (agent-proposed, user-approved)

## Member behavior

- The member's options, right-aligned, look like a radio list: a white card with a thin border and a divider between options, a radio circle beside each option that fills green when chosen, and a light green background on the chosen option. (user-originated)
- After the member picks an option, every option stays visible with the chosen one highlighted, so the member can change their pick in place, and the expert reply changes to match the new pick. (agent-proposed, user-approved)
- After a pick whose option has a reply, a short animation of typing dots ("...") plays in an expert bubble, then the reply appears. Members whose system has reduce-motion on get the reply straight away, with no dots. (agent-proposed, user-approved; the "..." dots user-originated)
- The field's label is not shown to the member: the expert's bubble is the question. The label names the answer in admin responses and exports. (agent-proposed, user-approved)

## Note box

- The admin sets per option whether the note box shows after that option is picked, so in the example it can show only after "not convinced". The admin can turn it on for every option. (agent-proposed, user-approved)
- The field's usual Required switch makes the choice required. Each option whose note box is on can also make the note required after that option. (agent-proposed, user-approved)

## Responses

- In admin responses, statistics, filters and CSV/HTML exports the choice behaves as a radio field's answer does today (counted, charted and filtered by option), and the note is its own text column. (agent-proposed, user-approved)

## Apps

- The first release supports both web and mobile member apps. Mobile builds that predate it show their existing "update the app" message for forms that use it. (agent-proposed, user-approved)
