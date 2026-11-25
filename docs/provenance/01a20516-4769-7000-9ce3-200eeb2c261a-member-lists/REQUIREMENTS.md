---
user: Charles Lien
task: Build Linear issue ALL-2174 (member lists as an expression input) in the variable-framework branch and open its PR.
---

# Requirements

The spec is `docs/provenance/01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec` (change 3); formulas are stored and edited as `docs/provenance/01a1f4f1-c0d1-7100-ae2a-42c26b35cfee-store-named-expressions` set up.

## Delivery

- ALL-2174 is built in the `variable-framework` branch and delivered as one PR. (user-originated)

## Lists in the language

- A member list is one input, "is on list X", usable inside any condition; staff-picked lists are how hand-picked inclusions and exclusions are expressed. (agent-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
- In text, a formula reads a list as `isOnList("California targets")`: one function whose argument is the name of an existing list. The stored tree holds the list's id and the text prints its current name, so renaming a list never breaks a formula. (agent-proposed, user-approved)

## Membership versions

- List membership has versions that fill sessions and live splits pin, and a version is kept while one still uses it. (ALL-2174-proposed, user-approved; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)

## Deleting a list

- Deleting a list is blocked when it would break, directly or through formulas, a form's rules or the split of a draft or scheduled suite; the error names each broken dependent and the reason, and the admin may instead delete it together with fixed dependents in one save. (user-originated; restated from 01a1c8da-8f1b-7459-9652-87f613c8693c-variable-framework-spec)
