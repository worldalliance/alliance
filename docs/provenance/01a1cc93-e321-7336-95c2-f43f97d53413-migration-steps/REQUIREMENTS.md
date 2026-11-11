---
user: Charles Lien
task: Add the migration steps to the root AGENTS.md Breaking changes rule: 1. old system; 2. support reading new system; 3. support writing new system; 4. remove writing old system; 5. migrate each item in old system to new system; 6. remove reading (and all of) old system. Any run of consecutive steps may be combined as long as they're atomic; for example, database migrations and backend server deploys run at different times.
---

- The root `AGENTS.md` **Breaking changes** rule lists these steps, in this order: (1) the old shape only; (2) support reading the new shape; (3) support writing the new shape; (4) remove writing the old shape; (5) move each existing old-shape item to the new shape; (6) remove the old shape, reads included. (user-originated)
- Reading and writing the new shape are separate steps, because adding both may not be atomic. (user-originated)
- Any run of consecutive steps may be combined into one change only where it lands atomically. A database migration and the backend server deploy run at different times, so they are not atomic with each other. (user-originated)
- The rule applies when something depending on the shape can't switch at the same moment as the change: stored or in-flight data, running or installed clients, other services, code outside the change. Adopting a rule existing code breaks takes the same steps, with the code that breaks it as the old shape. (agent-proposed, user-approved)
