# Decisions

## D1. Sidebar placement and route

Agent decision. "Kora participants" goes directly below "Projects" at `/kora-participants`, with the lucide `Baby` icon, outside the member Waitlist folder, since Kora participants are not waitlist entries (kora-participant-auth R1).

## D2. Server boundary

Agent decision. New `kora/admin` endpoints in `server/src/kora/`, behind the `AdminGuard` that `WaitlistAdminController` uses (R6). The member waitlist's services are built around `WaitlistEntry` (numeric ids, invites, organizations) and don't apply.

## D3. When a signup counts as abandoned

Agent decision. A `KoraParticipantSignup` row ends without a participant in two places: `forgetSignup` (the visitor backs out, or the browser signs in as another participant) and the hourly cron that deletes expired rows. Both delete the row and write a `KoraAbandonedSignup` row in one statement. A completed signup deletes its row through `completeSignup` and writes nothing. A signup is not recorded when, as it ends, its contact already has a participant, such as one finished in another browser, or has a signup at least as new still open, such as one a Google sign-in opened for the same email; that person has not dropped off. An older or expired signup still in the table doesn't hold back a newer attempt, so the record keeps the latest one. Each signup is judged as of when it ended, its expiry or the back-out, not when the hourly sweep deletes it, so a person who comes back between their signup expiring and the sweep is still recorded, and shows as recovered. Signups for one contact ending in the same run are recorded once, with the latest.

`KoraAbandonedSignup` holds one row per contact (unique on channel and destination), keeping the latest verification's method and time, as R7 requires.

## D4. Recovered is derived, not stored

Agent decision. An abandoned signup is recovered when a participant with the same contact exists, matched in `markRecovered` (emails case-insensitively, as their citext columns compare). D3 means any such participant was created after the abandonment, so a participant created by any later path, OAuth included, counts without a write to keep in sync.

## D5. Deletion

Agent decision. Deleting a participant asks for confirmation, then removes the row; sessions and OAuth identities cascade. It also deletes abandoned-signup records with the same contact, since a removal or privacy request covers all stored contact details. Abandoned records can be deleted on their own too.

## D6. Signups per day

Agent decision. Days are bucketed in UTC, as `WaitlistMetricsService` buckets its weeks.

## D7. CSV export

Agent decision. Built client-side from the loaded overview with `papaparse`, a maintained CSV library, per the root `AGENTS.md` preference for packages over hand-rolled sanitization; the form-responses export's hand-rolled escaper stays as it is. One file holds participants and abandoned signups, with a `Status` column (`participant`, `abandoned`, `recovered`). Every row is exported regardless of the page's search.

Names are user-entered and staff open the file in spreadsheets, so cells starting with `=`, `@`, tab or carriage return, or with `+` or `-` not followed by only digits, get a leading `'`. Papa's default also escapes every leading `+`, which would turn each E.164 phone number into `'+1…`; the narrower pattern keeps phone numbers usable for texting.

## D8. Search and sort

Agent decision. Search and sort run client-side over the full list, which stays small (the page's goal is 500 participants). Search matches name and contact case-insensitively; a numeric query also matches phone numbers ignoring spaces, dashes and parentheses. Participants sort by name, contact or signup date, newest signups first by default.

## D9. What the list shows for sign-in methods

Agent decision. A participant's methods are its contact's code channel (email or SMS code, always usable) plus each connected Google or Apple account. The repository does not record which methods a participant actually used.

## D10. Staging copies

Agent decision. `scripts/anonymize/anonymize.sql` empties `kora_abandoned_signup`, as it already empties the other Kora tables, since its rows are real contacts of people who never finished signing up and staging gets no stand-ins for them.
