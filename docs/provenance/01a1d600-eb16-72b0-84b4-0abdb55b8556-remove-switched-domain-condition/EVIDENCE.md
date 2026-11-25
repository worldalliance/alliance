# Evidence

## Stored SwitchedDomainAt conditions on staging

Method: on 2026-11-13, a read-only transaction against the staging database over the `staging` SSH host (the access `scripts/download_staging_data.sh` uses), searching every `form_snapshot.schema` as text for `"switchedDomainAt"`, and joining `form`, `action_update` and `general_update` to their current snapshots.

- The copy was current: its newest user row was created 2026-11-13 06:06 UTC, from that night's prod sync. 760 user rows, 163 with `switchedDomainAt` set.
- 0 of 2706 form snapshots mention `switchedDomainAt`, so no form, deleted form, action update, general update or historical snapshot carries a condition on it.
- Staging stands for prod's form schemas: `scripts/anonymize/anonymize.sql`, which builds staging from prod, redacts text answers in form responses but leaves `form_snapshot` untouched.

## Readers of the presence value

Method: `git grep -n -i switchedDomainAt` at `33f69cbb89` on 2026-11-13.

- Clients evaluate a `userPropertyHasValue` condition with `presence[cond.property] ?? false` (`common/src/forms/visibility.ts:248`), so an installed mobile build that receives presence without `switchedDomainAt` reads it as unset, and no stored condition names it.
- The column's remaining logic reader is the legacy-host sign-in block (`server/src/auth/auth.controller.ts:107-119`), through `UserDto`/`AuthService`, which this task leaves alone.
