---
user: Charles Lien
task: Edit the consult skill so the source annotations on each option have a shorthand and a legend, since they are hard to read.
---

# Requirements

- Each option's source annotation in a consult question message uses a shorthand, and the message carries a legend explaining it. (user-originated)
- The shorthand labels are one or two characters long. (user-originated)
- The labels sit at the very front of each option. (user-originated)
- The labels are `S` formal standard, `V` vendor recommendation, `R` research-backed practice, `C` common practice, `U` the user's earlier words, `B` the brainstormer, `O` the second opinion, `Me` the asking agent, set in a code span ahead of the option, with the research link and its claim in the option's text. (agent-proposed, user-approved from a rendered mock-up)

Supersedes the annotation wording in `01a1eb3d-cb79-7227-af1f-d3f9ef75ab8e-consult-before-asking`, whose requirement that each option names its source still holds.
