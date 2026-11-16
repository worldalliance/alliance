---
user: Alex Dorey
task: Add a scenario where Priya uploads a Kora .jsonl file of data and changes the project to Active
---

- Write the scenario at `docs/scenarios/upload-kora-transcripts-and-activate.md` now, for the persona `kora-project-admin`, as a spec for a feature that isn't built yet, clearly marked unbuilt. This supersedes the requirement in `docs/provenance/01a1c2cb-1ecf-7000-8e5d-067a2270f623-kora-project-admin-persona` to wait until the status control exists. (agent-proposed, user-approved)
- The upload and the project status (Pending, Active, Closed) both live on a new Kora page in the admin panel. (agent-proposed, user-approved)
- The `.jsonl` file holds one chatbot transcript per line for volunteers to rate as safe or unsafe. (agent-proposed, user-approved)
- Switching the project to Active opens rating of the uploaded transcripts for signed-in participants. (agent-proposed, user-approved)
- Trigger: KORA sends Priya a new batch file, and she wants volunteers rating it that day. (agent-proposed, user-approved)
- After an upload and before activating, she sees the number of transcripts read, the rejected lines by line number, and one randomly picked transcript previewed as participants will see it. (agent-proposed, user-approved; random selection is user-originated)
- A file with any invalid line is rejected whole, and nothing is imported. (agent-proposed, user-approved)
- Active is disabled until transcripts are uploaded, with a note explaining why. (agent-proposed, user-approved)
