---
user: Alex Dorey
task: Do ALL-2259, adding the index that allows a phone number on only one live account, and open a PR.
---

# Requirements

Follows the phone verification plan in `docs/provenance/01a1dd13-a21d-72ee-9b98-3eb3d46bb30f-verify-member-phone/`, whose server change (ALL-2246) is live in production.

- A phone number is held by at most one live account: a unique index `UQ_user_phone_number_live` on `user."phoneNumber"` over rows where `"deletedAt" IS NULL`, declared on the `User` entity through the existing `PHONE_NUMBER_INDEX` constant and created by a migration whose `down` drops it. Deleted accounts keep their numbers and don't count. (ALL-2259-proposed, user-approved)
- Tests that put two live accounts on one number are removed, since the index forbids that state: the "Inbound MMS keywords for a shared number" suite and the needs-reply test "lists each member who shares the number". (ALL-2259-proposed, user-approved)
- Docs in `server/src/mms/mms-unsub.service.ts` that speak of all members sharing a number are reworded to match one live holder. (ALL-2259-proposed, user-approved)
- E2e tests against the real index (ALL-2259-proposed, user-approved):
  - The database refuses a second live account with the same number.
  - A live account can take a number that only a deleted account holds; the profile update returns 201.
  - A profile update to a number another live account holds gets a 409 with "This phone number is already linked to an account. Enter a different number." and saves nothing.
  - A form's phone answer that another live account holds is skipped: nothing is saved and no welcome text goes out.
  - A profile update to a number that arrives while a verify of that number is running waits on the number's advisory lock, then gets a 409 once the verify saves.
- Before the migration reaches production, the production duplicate count is rechecked with the query in the verify-member-phone task's `EVIDENCE.md`, and any duplicates are resolved first. (ALL-2259-proposed, user-approved)
