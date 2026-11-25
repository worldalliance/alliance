---
user: Alex Dorey
task: "Admin panel conversation uploads: change the default 'Reviews each' to 5. Admin panel Kora conversations table view: change the table to show individual conversations rather than categories; show how many times each conversation has been reviewed and how long each question takes."
---

# Requirements

- The admin upload form's "Reviews per transcript" field (shown as "Reviews each" in the batches table) defaults to 5. (user-originated)
- The Kora admin's Categories table is replaced by a table with one row per conversation; the per-category opt-out count goes with it. (user-originated for the per-conversation table; agent-proposed, user-approved for replacing rather than keeping both)
- Each conversation's row shows how many times it has been reviewed. (user-originated)
- Each conversation's row shows how long its reviews take, from the time the review tool already records per conversation (time open while the page was visible), not per question within a review. (agent-proposed, user-approved)
- Review time is shown as the median, with the fastest and slowest review. (agent-proposed, user-approved)
- The table lists conversations in every batch, retired and closed ones included. (user-originated)
