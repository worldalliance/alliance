# Never-signed agreement reminder spec

Status: implemented. [REQUIREMENTS.md](./REQUIREMENTS.md) defines the behavior and copy, with origins distinguished. The choices and acceptance checks below are agent-authored.

## Integration

- Extend the existing contract-reminder worker and mail rendering path. Keep `EmailType.ContractReminder` for both arms so introducing the experiment cannot bypass the address-based suppression query.
- Preserve the worker's exact eligibility query, scheduling, delivery-enabled guard, and advisory lock. Its age boundary is `createdAt <= now - 24 hours`; preserve that boundary under the requirement to keep the trigger unchanged. Its account and contract-event reads retain their existing soft-delete behavior.
- Assign an arm only after an account qualifies for this reminder. Apply the experiment to eligible existing and future accounts; historical reminder rows continue to suppress sends. Deployment needs no historical assignment backfill, separate rollout control, or resend campaign.
- Reuse `assignExperimentArm` with a dedicated `Experiment.ContractReminder` value. This keeps the saved 50/50 choice independent of other experiments and stable if an attempt fails or the account's email changes. The current email address still governs suppression.
- Select the subject, body, and destination together from the saved arm. Keep selection local to contract reminders, since applying the variant's copy or subject rule globally would affect other emails. Preserve the control's rendered content except for per-message tracking identifiers.
- Both arms share `contractreminder.pug`, branching on the copy version, with an unknown version throwing during rendering so no failure falls back to control copy. The `<title>` takes the selected subject. The control branch renders byte-identical HTML to the previous template.
- Use the existing `nameParts` result for both arms and escaped template interpolation so name values remain literal text.
- Build the membership URL with the same configured-host selection used by existing application links. Render the variant's agreement and video URLs as clickable links at the positions specified in its body. Keep the control's existing link presentation: its application URL stays plain text, which link tagging still tags.

## Evidence and storage

- Add the dedicated value to the database experiment enum with a migration. `migration:generate` also emits unrelated `friend` generated-column drift that predates this change; the migration omits it. Create assignments lazily; leave historical emails and tracking records unclassified by this experiment. Migration sends no messages.
- Extend the validated message-tracking context with a contract-reminder copy version distinguishing the preserved control from the supplied agreement copy, and populate its existing subject field. The saved assignment identifies the arm; the message context identifies the selected version and subject. Existing `Mail` records retain the rendered HTML, recipient address, status, and tracking ID.
- Reuse `MessageSource.ContractReminder`, the existing message owner, link-opening records, and contract-event timestamps. These provide the joins for manual delivery, click, and subsequent-signing comparisons without a new analytics subsystem or fixed conversion window.
- Preserve existing link-tagging behavior: the application link receives message tracking; the external YouTube destination stays intact. Additional video-click instrumentation is outside this specification.

## Failures and application scope

- Assignment or tracking persistence failure prevents sending an unclassified message; report the error through the existing worker logging. A later hourly pass can try again when no reminder mail row was saved, using any assignment already persisted. Once a mail row exists, the approved suppression behavior applies regardless of delivery status.
- Preserve the current timing of eligibility evaluation and the current per-recipient error isolation. Adding a send-time contract recheck, changing concurrent-signing behavior, or retrying recorded failed mail would change delivery policy beyond this copy experiment.
- Use the existing membership screen and authentication flows on web and mobile. A recipient who has signed since the email was prepared sees the destination's current account state.

## Acceptance checks for implementation

1. With a controlled clock, verify the preserved 24-hour boundary and hourly eligibility: a newer account is excluded, an eligible unsigned account is included, and an account with a contract event is excluded. Preserve the existing soft-delete filters and delivery-disabled behavior.
2. A prior contract-reminder mail row for the address suppresses both arms, including pending, failed, and soft-deleted rows. An unrelated email type does not suppress this reminder. Historical recipients receive no extra experiment email.
3. Assignment is persisted once per account for this experiment, remains independent of other experiments, and survives repeat attempts and email changes. Selection exercises both arms; equal probability is not an exactly balanced batch quota.
4. Render each arm and compare its subject, paragraph text, greeting, and link presentation against the requirements. Verify first-word name handling for single-word, multiword, surrounding-whitespace, blank, and HTML-special-character names, without introducing a variant-only fallback. The existing `common/src/nameParts.test.ts` covers the splitting cases; the mail tests cover escaping.
5. Control application links resolve to `/tasks`; variant application links resolve to `/membership`. Both retain the configured host and existing message tracking. Both video links retain the approved URL and start time.
6. Stored records join account, experiment assignment, selected copy version, subject, rendered email, send outcome, link openings, and later signing events. A saved assignment or failed mail is distinguishable from a successfully sent variant.
7. Assignment, rendering, tracking, and transport failures follow the specified suppression and error behavior. Failure for one recipient does not prevent attempts for other eligible recipients; no failure silently substitutes control copy.
8. The migration preserves historical sends and creates no deliveries. Authentication routing, agreement screens, channels, and recipient preferences retain their current behavior.
9. Run focused server tests and server package typechecking, then the repository duplication and changed-line coverage checks. Rendered email assertions should protect the control while testing the new variant.
