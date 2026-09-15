# Decisions

- The "unused payment flow" is the whole `server/src/payments` module.
  `PaymentsModule` has been out of `AppModule` since 3f84034f3, so its endpoints
  404, and its only job was completing a Funding action after a Stripe payment.
  The module, its e2e spec, the `stripe` server dependency, the unused
  `@stripe/*` frontend dependencies, the Stripe env vars in `deploy.yaml` and
  `server/.env.example`, and the commented-out payment method code in
  `SettingsPage` all go.
- The user chose to drop the `payment_user_data_token` table and
  `user.stripeCustomerId`, from options the agent proposed. The staging copy in
  the local db had 10 token rows and 66 users with a Stripe customer id. Stripe
  customers carry `metadata.userId`, so that link survives in Stripe.
- The work lands as these commits, each of which typechecks and passes its tests
  on its own:
  - payments server code
  - frontend Stripe packages
  - payment schema (`removePaymentData` migration)
  - payments in the privacy policy
  - client reads of the action type
  - the Funding type (`removeFundingActionType` migration)
  - the partial signup email type (`removePartialSignupEmailType` migration)
  - the partial profile flag (`removePartialProfileFlag` migration)
- The clients stop reading `type` and `donationAmount` a commit before the
  server stops sending them. A web tab loaded before the server deploy runs the
  old `ActionTaskPanel`, which only rendered the task form for
  `type === "Activity"`, and nothing forces a reload on a new build.
- `migration:generate` never drops a table whose entity is gone, so
  `DROP TABLE "payment_user_data_token"` in `removePaymentData` is hand-added,
  with the original `CREATE TABLE` from `1750802129511-partialProfiles` in
  `down`. The rest of both migrations is generated. `down` restores empty
  columns and an empty table.
- `removeFundingActionType` checks for `Funding` actions first and throws with
  their ids, the same way the Ongoing migration does. Dropping the column would
  otherwise succeed and lose the type silently. TypeORM runs pending migrations
  in one transaction, so if `removePaymentData` is pending in the same run, the
  throw rolls it back too. Verified locally by marking action 9 `Funding`: the
  migration threw, and `type` and `donationAmount` survived. After restoring the
  row it ran, and a second `migration:generate` found no schema changes.
- With the type gone, the frontend `ActionTaskPanel` renders the task form when
  `taskFormId` is set and "Couldn't load action contents" otherwise. The `draft`
  branch and the bare `errorMessageNode` return after it were only reachable for
  a Funding action, so they're deleted.
- The admin dashboard's "Task Form" and "Form Variants" tabs keep the check that
  an action is loaded, which `action?.type === "Activity"` also did. The "Task
  form linked" readiness item is now always listed.
- The admin input handler's numeric branch matched `donationThreshold` and
  `donationAmount`. `donationThreshold` was dropped in `1756337175565-addStaffCol`,
  so the branch had no field left and is deleted. The `type === "Funding"` reset
  of `taskFormId` goes with it.
- `actionType` is dropped from the `ActionCompleted` (server) and `FormStarted`
  (frontend and mobile) analytics events.
- Only the payment flow created partial profiles, and the staging copy in the
  local db has none of 613 users flagged. `UserService.createPartialProfile`,
  the `user.isNotSignedUpPartialProfile` column, and every reader go: the
  active-user filters in `UserService` and the contract reminder worker, the
  flag clears on password reset and OAuth linking, the field in
  `UpdateProfileDto` (no client sent it), and the two e2e tests that built a
  partial profile by hand. Other tests already cover password reset and linking
  an existing account.
- With every user a candidate, `isCandidate` leaves `SingleUserCohortPredicates`
  and the single-user `NOT` universe is always `{userId}`. The spec loses the
  non-candidate case, and its parity test counts all five users as candidates.
- `removePartialProfileFlag` throws with the ids of any partial profile before
  dropping the column, since those users would otherwise start receiving
  contract reminders and counting as active members. Verified locally by
  flagging user 7: the migration threw and the column survived. After clearing
  the flag it ran, and `schema:log` found no schema changes.
- The seed's `migrations_id_seq` was dumped before the rebase that brought in
  `1789418641611-action-staff-preview`, so `reseed.sh` miscounts the migrations
  to revert. It is run with `--revert 3`.
- `MailService.sendPartialSignupEmail` had one caller, the payments service, and
  is deleted. `EmailType.PartialSignup`, its `partial-signup.pug` template, and
  the templates map entry go in their own commit with the generated
  `removePartialSignupEmailType` migration. The staging copy in the local db has
  no `partial_signup` mail rows, so the migration doesn't handle any. If
  production holds one, the enum cast fails and the migration rolls back.
- The raw-body parser for `SIGNED_WEBHOOK_ROUTES`, whose only route was
  `/payments/webhook`, is deleted. That left `body-parsers.ts` with two calls,
  which move into `configureApp`.
- Fixtures keep their entries and lose only `type` and `donationAmount`. The
  former Funding entry in `ActionLink.stories.tsx` still shows the completed
  state.
- `citesting/fixtures/seed_dataonly.sql` is regenerated with
  `citesting/scripts/reseed.sh`, since its COPY statements named the dropped
  columns and table. All 37 seed actions were `Activity`.
- Old action export JSON can still carry `type` and `donationAmount`.
  `importAction` spreads them into `actionRepo.insert`, which writes only known
  columns, so the keys are ignored.
