# Decisions

- **Overrides rather than a per-kind default.** Both the script and signup write `notification_preference` rows set to off for `action_updates` text and email. A per-kind default in `KIND_POLICY` would also have to reach `resolveSetting`'s callers on the server and in `shared/lib/notificationSettings.ts`, and the settings DTO. Rows reuse the resolution rule unchanged. One consequence: a member who clears the override (sets it to "follow default") falls back to their channel default, which is usually on.
- **Script rows are `source = 'migrated'`.** The script is a one-off data change, and `migrated` already exists in the enum, so it runs on staging before the code below deploys.
- **Signup rows are a new `source = 'new_account'`.** The admin user page shows each override's source. "Carried over by migration" would be wrong for an account created after it, so signup gets its own label, "Off for new accounts". Requires the enum migration `NotificationPreferenceNewAccountSource`.
- **Members' own choices are kept** by the upsert's `WHERE source <> 'member'`. Existing `migrated` rows are overwritten, though the original migration wrote none for these cells.
- **The script covers soft-deleted users too.** A restored account then keeps the same setting. Its before/after counts report live users only.
- **Dry run by default.** The SQL runs in one transaction and rolls back unless `--apply` is passed, printing before/after counts either way.
- **Prod-ready through the staging host.** The staging host's `db-sync.env` holds both `STAGING_DB_*` and `PROD_DB_*` (as `sync_prod_to_staging.sh` reads them), so `prod` as the first argument switches the target without a second SSH setup.
- **Only `UserService.insertUser` creates accounts**, so the signup rows go in there, in the account's own transaction.
