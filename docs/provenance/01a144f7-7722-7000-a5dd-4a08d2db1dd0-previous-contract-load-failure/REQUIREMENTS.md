---
user: Charles Lien
task: Membership page reports a previously signed contract that fails to load
---

# Requirements

Origin labels: **user** = Charles Lien; **agent, user-approved** = proposed by an orchestrating agent and approved by Charles Lien.

1. **(user)** A failed load of the member's previously signed contract on the membership page must not fail silently.
2. **(agent, user-approved)** `useContractById` fails loudly: an HTTP error response from the contract-by-id endpoint makes the query enter an error state instead of resolving to `null`. Its other callers stay correct.
3. **(agent, user-approved)** The membership agreement hook exposes that failure, and both the web membership page and the mobile membership screen show the existing `LoadFailed` component with a retry button where the previously signed contract would be, following the pattern already used for a failed load of the current contract.
4. **(agent, user-approved)** The "An updated agreement is available." notice shows when the member's signed contract id is set, differs from the latest contract's id, and the latest contract has loaded. It does not wait for the previously signed contract to load.
