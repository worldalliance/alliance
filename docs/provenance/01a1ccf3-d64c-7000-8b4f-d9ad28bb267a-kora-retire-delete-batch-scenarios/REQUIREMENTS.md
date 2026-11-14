---
user: Alex Dorey
task: Scenario where the Kora admin retires a batch of chat pairs, and where the Kora admin deletes a .jsonl batch on the staging server
---

- Two scenarios for the persona `kora-project-admin`, both marked unbuilt: retiring a batch in production, and deleting a test batch on staging. (agent-proposed, user-approved)
- Retiring a batch stops its chat pairs being assigned to volunteers. Ratings already given are kept in results and the export, marked as from a retired batch. (agent-proposed, user-approved)
- A retired batch stays in the Batches table marked Retired, with a Reactivate action that makes its chat pairs assignable again. (agent-proposed, user-approved)
- When a batch is retired or deleted, unrated chat pairs from it drop out of volunteers' in-progress assignments without any message to the volunteer; pairs already rated still count. (agent-proposed, user-approved)
- Delete is available only on staging; production offers only Retire. (agent-proposed, user-approved)
- Deleting a batch removes the batch, its chat pairs and their ratings. The confirmation names the batch by upload date and states how many chat pairs and ratings will be removed, with a single Delete button. (agent-proposed, user-approved)
- Priya, the existing Kora admin persona, is the one who deletes test batches on staging. (agent-proposed, user-approved)
