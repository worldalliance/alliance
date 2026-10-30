---
user: Charles Lien
task: Document expand-migrate-contract, with a ratchet
---

# Requirements

- Agent instructions state that breaking changes follow the standard expand-migrate-contract process. This covers code migrations, such as adopting the 500-line file limit, as well as database migrations. (User-originated.)
- The process includes a ratchet, so the old shape can't grow back, like the 500-line limit (a change that would leave a file past 500 lines splits it first) and the time zone rollout (signup captures the device's zone, so new accounts arrive with one while older ones are backfilled). (User-originated.)
- The instruction names the practice without spelling out its steps. Agents understand or research expand-migrate-contract on their own, and uniform execution across agents isn't needed here. (User-originated.)
