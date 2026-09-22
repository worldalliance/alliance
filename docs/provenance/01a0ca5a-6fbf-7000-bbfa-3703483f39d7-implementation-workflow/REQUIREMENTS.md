---
user: Charles Lien
task: Improve implementation discipline before independent review
---

- The user reports that implementors miss engineering rules, including deduplication, leading to roughly ten review cycles per commit with most findings worth fixing.
- The user uses separate agents for specification, implementation, and fresh-context review, selecting which findings to fix.
- The experimental workflow runner is not planned for near-term use.
- The user approved the assistant's proposal to add a concrete implementation procedure and shared engineering criteria while retaining the existing handoffs. The approved proposal prioritizes discovery and verification during implementation over adding review stages or expanding the runner.
