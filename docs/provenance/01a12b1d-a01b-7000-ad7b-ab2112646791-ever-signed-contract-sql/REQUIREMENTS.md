---
user: Charles Lien
task: One source of truth for the contract-status SQL rules
---

## Requirements

- Raw SQL that asks whether a member's contract is active calls `sqlUserHasActiveContractAt`, including the invite-link admin's retained-signer count. (agent-proposed, user-approved)
- Raw SQL that asks whether a member has ever signed a contract calls one shared helper beside `sqlUserHasActiveContractAt`, so the invite-link admin, the waitlist metrics, and the welcome queue cannot count signers differently. (agent-proposed, user-approved)
- One deduplicated item per standalone commit. (user-originated)
