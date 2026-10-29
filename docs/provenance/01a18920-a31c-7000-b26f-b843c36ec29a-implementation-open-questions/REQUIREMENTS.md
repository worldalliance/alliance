---
user: Charles Lien
task: Share the specification interview question format with implementation
---

## Agent-proposed, user-approved

- When a code task leaves open a question whose answer would change the implementation, the agent asks the user before writing code, in the open-questions format: one numbered plain-text message, lettered options with the recommendation first and "I don't care" last. It keeps asking until no question is open. A request that leaves none open goes straight to implementation.
