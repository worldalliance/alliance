---
user: Charles Lien
task: Distinguish requests for explanations from requests for action
---

## User-origin requirements

- `AGENTS.md` tells agents that a request for explanation or justification asks for an answer, not for a change. The agent answers it and acts only within the user's authorized scope.
- A question about the agent's recommendation, such as "why are you suggesting X?", asks for its reasoning. It neither signals that the user disagrees nor asks the agent to switch course.
- Explain the recommendation and revise it only where the reasoning fails.
- Include an explicit example: after the agent suggests X, the user asks "Why X?"; the agent explains its reasoning without inferring opposition to X.

## Agent-proposed, user-approved

- Interpret the user's intended request in context. Requests to perform work authorize that work even when phrased as questions; requests to explain, evaluate, compare, or justify authorize investigation and an answer without unrequested changes.
