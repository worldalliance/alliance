---
user: Alex Dorey
task: Fix the "Invalid input" ZodError from parseKoraTranscript on the frontend's KORA review page (/projects/safer-chatbots-for-children/review) for test participant 0505.
---

# Requirements

- The KORA review page loads a reviewer's assigned transcripts without a ZodError when they are valid against the current `kora-review` transcript schema. (user-originated)
