# Remove streak-recognition reminders

This specification implements the choices recorded in [REQUIREMENTS.md](./REQUIREMENTS.md). The deployment mechanics and verification below are agent decisions. Implementation remains a separate request.

## Evidence and scope

The production inspection during this interview found the original migration applied, zero enabled streak reminder groups, zero groups with the preset's generated name, zero streak experiment assignments, and zero notification records with streak metadata. One suite had the new onboarding flag. These observations justify removing unused storage; they do not replace the cleanup-time check.

The reverse patch passed a read-only applicability check against local `1c123d9e0`. The nine commits between the feature and the inspected GitHub main revision `43c21af06b` neither modified its files nor referenced its added symbols. Recheck subsequent changes when implementing.

Use `63070b1^` as the behavioral baseline for this feature. Reverse the PR's application changes while preserving later unrelated work. Retain the original feature provenance as history; this specification governs removal.

## Resulting behavior

- Ordinary reminders use their configured push, SMS, email subject, and email body. Streak milestones neither alter copy nor create an extra in-app entry or experiment assignment.
- Admin loses the Streak recognition preset, checkbox, and card annotation. Populate default reminders uses Two Day Range in the existing 24–48-hour slot.
- Remove the API flag and regenerate the shared client from the restored server contract.
- Restore the earlier suite-outcome calculation and missed-suite call paths. Reverse the helper extractions introduced by this PR together with their callers, so removal leaves no orphaned helper or import.
- Preserve missed-suite notices, suspension rules, reminder deduplication, delivery preferences, configured reminder schedules and copy, and the independent action-update recognition experiment.
- Existing notification, mail, SMS, and push records remain. An enabled streak reminder reaches the cleanup guard rather than being silently converted. Member-facing web and mobile need no new UI.

## Database removal

Keep `1791324775327-StreakRecognition.ts` unchanged and add a generated forward migration. Generate it after removing the corresponding entity definitions, then review and adjust ordering as required by the migrations skill.

Remove the PR's five columns: `reminder_group.streakRecognition`, `action_suite.onboarding`, and `action_event_notif.streakCount`, `streakRunSuiteId`, and `streakRecognitionCopy`. Remove its milestone unique index, the `StreakRecognitionCopy` enum, and only the `streak_recognition` value from `Experiment`.

Keep the pre-existing action-level onboarding flag, other experiment values and assignments, the experiment-assignment uniqueness constraint, and the notification relationships used by missed-suite notices. Fresh databases must reach the same final schema by applying the original migration followed by the removal.

The original migration's `down` deletes streak assignments. The new migration instead enforces the approved usage guard before any destructive statement. It fails when any of these exists:

- A reminder group with recognition enabled, whether or not it is marked all sent.
- An assignment to the streak experiment, in either arm.
- A notification with any non-null streak count, run identifier, or copy value, including an unsent record.

Check and removal belong to one transaction with write exclusion covering these tables, so a concurrent writer cannot invalidate the check. A guard failure preserves schema and data and reports which aggregate counts blocked cleanup. Logs contain no member identifiers or message contents.

The removal migration's `down` reconstructs a schema compatible with the feature version, including its index, enum values, column defaults, and onboarding seed behavior. It is used for failed-deployment recovery, not to erase migration history.

## Deployment and recovery

The current deploy runs migrations while the old backend is alive and restarts old code on failure without restoring schema. Both behaviors must be accounted for in the removal change. Merging to main deploys staging; normal promotion to production deploys the same removal there.

Limit special handling to a deployment that will apply this removal migration. Prepare the release and install dependencies before the interruption, then:

1. Hold the existing deployment/migration lock through success or recovery, preserving coordination with staging refresh.
2. Stop the old backend and its notification worker before cleanup. Establish that its database work has ended before running the guarded migration.
3. Apply the pending migrations. The usage guard also applies when this migration runs outside the deploy workflow.
4. Start the new backend and run its health check before declaring the deployment successful.

Recovery depends on the recorded database state:

| Failure                                                        | Required recovery                                                                                                           |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Preparation or backend shutdown fails                          | Apply no cleanup; retain or restore the old service.                                                                        |
| Usage guard rejects cleanup or the migration transaction fails | Keep the unchanged schema, restore the old release, and fail the deployment with the cause.                                 |
| Cleanup commits but new startup or health verification fails   | Stop the new backend, reverse this cleanup from the new release, verify schema compatibility, then restart the old release. |
| Schema restoration fails                                       | Leave the incompatible backend stopped and surface the failure for operator recovery.                                       |

Determine whether cleanup committed from migration records, including after a command disconnects. Reverse this migration specifically; never blindly revert the latest unrelated migration. Test that recovery also restores migration bookkeeping so a subsequent deployment can retry.

Routine success and a successful automatic recovery require no manual database commands. Operator intervention is reserved for the approved usage pause or failed recovery.

The staging refresh also applies migrations to a production copy before swapping it into staging. Keep its existing lock coordination and failure-before-swap behavior. A copied database that trips the usage guard must leave the current staging database in place.

## Acceptance checks

Implementation is complete when the following pass:

1. Admin tests show the ordinary 24–48-hour default and no streak controls. The regenerated API contract has no recognition flag.
2. A member with a former milestone receives only ordinary reminder copy and channels. Sending and rerunning create neither streak assignments nor additional recognition entries, and preserve reminder deduplication.
3. Existing missed-suite notice, contract-suspension, and action-update recognition tests remain green.
4. Applying migrations to both a fresh database and an upgraded synthetic database produces the entity schema. Unrelated records and constraints survive removal.
5. Each guard condition independently rejects cleanup without schema or data loss; test both experiment arms and unsent streak records. The seeded suite onboarding flag alone does not block removal.
6. Deployment tests establish stop-before-cleanup, successful startup, guarded abort with old-service recovery, post-cleanup failure with schema restoration, retry after recovery, and a loud failure when restoration cannot complete.
7. Staging refresh can migrate an unused-feature production copy; a guarded failure leaves the existing staging database untouched.
8. Run the affected package typechecks and tests, relevant server end-to-end suites, schema drift verification, formatting, duplication and coverage checks, and workflow/script checks required by repository instructions.

Use synthetic fixtures for migration and deployment failure tests. Verification must exercise the recovery sequence without delivering real notifications or changing production data.

## Implementation decisions

- The branch was fast-forwarded to `origin/main` (`98a98b7e2`) before implementing, with the user's approval, because #483 (link tracking) changed the reminder worker and `reminder-in-app-entry.ts`. Every PR file now matches `63070b1^` except for #483's changes, which stay. `sendReminderInAppEntry` is inlined back into the missed-suite notice together with #483's save of the in-app entry.
- `shared/client/types.gen.ts` only loses the three `streakRecognition` lines. A fresh regeneration also drops a waitlist `reason` doc comment, because main's client was already out of date there. That hunk is left out as unrelated.
- The migration is generated, then edited by hand. The generator also emitted a rebuild of `friend`'s generated columns. That comes from local `typeorm_metadata` copied from staging, not from this change, so it was removed. The `down` index columns are put back in the original migration's order, and the `Onboarding` seed is added again.
- The usage guard runs after `LOCK TABLE … IN ACCESS EXCLUSIVE MODE` on the three guarded tables. That lock waits for any write still running from the stopped backend, keeps out new writers until commit, and fails when the migration runs outside a transaction.
- The backend swap moved out of `deploy.yaml` and into `scripts/deploy_backend.sh`, so stubbed `pm2`/`bun`/`curl` tests can run it. The normal path is the old inline script unchanged. The stop-first path runs only when `server/scripts/streak-recognition-removal.ts state` reports the removal as `pending`. After it ships everywhere, that path stays dormant until someone deletes it.
- Stopping the backend is confirmed when `nest-app` no longer appears in `pm2 jlist`. The worker's cron runs inside that process.
- Recovery reverts the removal through `revertRemoval`. It refuses unless the removal is the latest recorded migration. After the revert it checks that the migration record is gone and that the five columns exist again. If any recovery step fails, the backend stays stopped and the deploy fails with an `::error::`.
- Staging refresh is unchanged. Its migration step already runs before the swap under `set -e`, and its `EXIT` trap drops the scratch database while leaving staging alone. So a guarded failure keeps the current staging database. No script-level test covers this. The sync script hardcodes `/home/ec2-user` paths, and the guard behavior itself has its own migration tests.
