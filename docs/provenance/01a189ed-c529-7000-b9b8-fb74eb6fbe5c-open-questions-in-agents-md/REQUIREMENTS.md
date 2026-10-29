---
user: Charles Lien
task: Make every agent ask provenance-bound questions in the open-questions format
---

# Requirements

- Every question to the user whose answer will be recorded in provenance, in any task, uses the open-questions format: one numbered plain-text message, lettered options per question with the recommendation first, then alternatives, then "I don't care". (user)
- Questions whose answers will not be recorded in provenance, such as asking permission to run a command, are asked plainly, without the format. (user)
- An agent that never opens the implement or spec skill still applies the format. (user)
