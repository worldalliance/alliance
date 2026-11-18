# Decisions

The design starts from ALL-2238 and the plan it cites, `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/` (decision 6). Both are agent proposals; the user approved the issue's points as REQUIREMENTS.md 3–10. Each question put to the user was weighed with research, brainstorm and second-opinion subagents, as REQUIREMENTS.md 2 asks; `EVIDENCE.md` holds their findings and the research a decision cites. Unless a decision says the user chose, it is the agent's, and a later agent may change one that causes friction.

## 1. Each job stays correct with no lock at all

The advisory locks stay. The waitlist sender's body moves into a public `sendDue`, which `run` calls under the lock, so tests can start two runs at once, as `docs/provenance/01a1e58f-2580-7098-8fee-732c8e7d9bd0-cron-overlap-member-messages/` did for its four jobs. Recognition delivery's `deliverPrepared` and the participant writers were already callable without the lock.

## 2. Waitlist emails: an attempt owner, and a 15-minute sweep that only labels

This supersedes, in `docs/provenance/01a0eecc-41de-7000-b934-1cbb7feba3cb-organization-waitlist/` (decision "Sending runs in the server"), a run marking a recipient it finds still `sending` uncertain at once.

- `waitlist_email_recipient.attemptId` (uuid) is set together with `sending`. `record` writes the outcome, and the mobilization with it, only where `attemptId` still matches; any other answer is dropped and logged. A late answer to the same attempt therefore replaces an `uncertain` label, which is more accurate.
- Staff retry clears `attemptId`, so every answer from an attempt before the retry is dropped, Sent included, and the retry sends again. Staff can retry only a `failed` or `uncertain` row. A `failed` row's attempt has already answered, so no late answer remains. An `uncertain` row's attempt may still answer, and the retry dialog warns that those recipients could get the email twice, so retrying is staff accepting that risk, as requirement 10 allows. Requirement 4 asks that an old run can't overwrite a newer run's result. Recording a superseded Sent answer instead would avoid that duplicate, but the row would then show the newer attempt's invite and rendered email, not the ones delivered (agent judgement).
- A new run labels a `sending` row uncertain only once `attemptedAt` is 15 minutes old. Without a lock it can't tell a dead send from a slow one, and the label never resends anything; it only lets staff choose to retry. 15 minutes exceeds nodemailer's 10-minute idle socket timeout. Considered and not chosen: a cancellable hard deadline (nodemailer 7.0.13 can't cancel a send, and a JavaScript timer is late after the same pause), and a heartbeat (stops during the pauses and pool exhaustion it would detect, and stays fresh for a send hung in a live process). `EVIDENCE.md`, "Waitlist: telling a dead send from a slow one".
- The swept error reads "No answer was recorded within 15 minutes of sending", since "Sending stopped before the mail server answered" is no longer known to be true, and the usual cause, a server process dying mid-send, isn't the mail server's fault.
- Rows left `sending` with a null `attemptedAt` are not swept. `prepare` always sets both together, so no such row arises.
- A run that hangs while holding its lease keeps every other run, and so the sweep, from starting. That belongs to the lease design in ALL-2236.

## 3. Recognition delivery: reserve each channel just before sending it

This supersedes, in `docs/provenance/01a10e0b-52d6-7000-80bf-78e4b8829f57-action-update-recognition/` (decision "Delivery"), a retaken claim sending every channel with no recorded outcome.

- `action_update_exposure` gains `textStartedAt` and `emailStartedAt`. Before sending a text or email, the run sets that column with one conditional update: only while it still holds the claim, the row isn't deleted, the column is null and no outcome is recorded. It sends only if the update took. The checks read the row, not the exposure loaded at the start of the batch.
- A channel started but never recorded may have reached the provider, so a retaken claim never sends it again; the run holding the claim that finds it logs a warning with the exposure's id, since nothing else shows the send is unresolved until ALL-2298. Channels never started still go out, which a reservation per channel allows and a single whole-recipient flag would not.
- The final `deliveredAt` write also requires the claim, so a run that lost its claim can't mark delivered a row another run is still delivering.
- Push needs no reservation: `PushService.sendMessages` saves a row keyed by `uc-<entry>-<device>` before dispatch, and a repeat of the key sends nothing.
- Considered and not chosen: renewing the claim before each channel. A run can still send, pause past the claim's expiry, and lose the race to record it; another run would then resend.

## 4. Unknown recognition outcomes: the staff view ships separately, as ALL-2298

REQUIREMENTS.md 10 makes staff visibility of unresolved sends required. The agent's choice is to ship it in its own pull request, ALL-2298, since a second opinion estimated it at several times this change's size, with a Mailgun and Twilio lookup, a reconciliation worker, review endpoints, an admin view and the deliberate staff resend.

This change is a safe step toward it: a text or email that a run reserved but never recorded is never resent, so overlapping runs send no duplicates. Until ALL-2298 ships, such a send stays unresolved and staff can't see it, including one reserved by a run that crashed before handing it to the provider; only the warning the retaking run logs shows it. ALL-2298 adds the evidence check (provider records, and our own record that a send was never handed over), the staff view, and the resend. Before this change, recognition delivery retried any channel without a record once its claim expired. `EVIDENCE.md`, "Unknown send outcomes".

Requirement 10 also covers a text or email whose provider call errors or times out, since its outcome may be unknown; decision 10 meets it there, as REQUIREMENTS.md 11 asks.

## 5. Participant count: writes ordered by a computation number

This supersedes two decisions in `docs/provenance/01a1ae93-d8a7-7000-b705-22068d11865e-users-joined-batch/`: the sweep guarding each write by the count it read, and the single-action reload writing unconditionally.

- `action.usersJoinedComputation` (bigint) holds the number of the computation that wrote `usersJoined`. Each computation takes a number before its first read and writes only where the stored number is smaller. Both the sweep and the single-action reload do this, through one `publishUsersJoined`. The sweep writes every action's count, changed or not, because an unchanged result still has to fence out older ones.
- The number comes from `nextval` on the column's own sequence: `usersJoinedComputation` is `generated: "increment"`, a `BIGSERIAL`, so `synchronize(true)` creates the sequence in e2e as the migration does in production. With `CACHE 1`, the default, Postgres issues the numbers in order across sessions, and `pg_dump` restores the sequence's position with the table, so a restored database keeps issuing numbers above the stored ones. `EVIDENCE.md`, "Ordering recomputations of a cached count" and "Measurements".
- Considered and not chosen: `pg_current_xact_id()`, which a restore into another cluster freezes, since the stored numbers can sit above every transaction ID the new cluster hands out; overwriting stored numbers above the current transaction ID, which races, since a computation that starts mid-sweep can take a larger ID and land first; resetting the column in the restore scripts, which misses every other restore path; a timestamp (ties, a clock stepping back, and microseconds lost through JavaScript); and locking the action row while counting (it would block admin edits and, through foreign-key checks, the membership writes it counts, for the whole sweep).
- `usersJoined` and `usersJoinedComputation` are `update: false`, so `ActionsService.update`'s whole-entity save, which reloads and diffs the row, can't restore the count it loaded. TypeORM then skips them in `repository.update` too, so the writers use raw SQL. Raw SQL doesn't bump `updatedAt`, so it now moves only when the action is edited, not when its count is recomputed, reversing users-joined-batch's choice to keep that bump; nothing reads it as a sign the count changed. Leaving the field out of that one save would also work; `update: false` covers every save path, and nothing else writes the count.
- A new or imported action takes its first number from the sequence, never the export's. A sweep that started before the action was created skips it, so the action shows 0 joined until a reload or the next sweep, which runs every ten minutes.
- Still not covered, as before: membership changes that trigger no reload, such as away ranges and contract changes, wait for the next sweep.

## 6. Task badges: no change

`TaskBadgeService.syncUser` claims only devices whose `badgeCountComputedAt` is null or older than its start, so an older computation can't replace a newer count. The two later writes only set `badgeCount` to null, which makes the next sync resend; guarding them by owner would break recovery from a failed send of the same count. No write matching the audit's "an older result can overwrite a newer one" was found.

## 7. Already safe, no change

Restated from the plan's audit (`EVIDENCE.md` "Overlap per locked job" in the lease-locks directory), as REQUIREMENTS.md 8 asks: cohort decisions insert under a unique key, so the first writer wins; the MMS media copy compare-and-sets the stored key; divergence logging only writes duplicate log lines.

## 8. Tests live in new specs

`test/waitlist-email.e2e-spec.ts` and `test/action-update-recognition.e2e-spec.ts` were at their baseline line waivers, so the overlap tests went into `waitlist-email-overlap.e2e-spec.ts` and `action-update-recognition-overlap.e2e-spec.ts`. The recognition builders moved to `action-update-recognition-fixtures.ts` and the waitlist ones to `waitlist-email-fixtures.ts`, each shared by both specs of its job. The old test of the sweep's immediate relabelling moved to the overlap spec with the 15-minute rule. Both waivers dropped to their new ceilings.

## 9. Migrations carry only their columns

`migration:generate` also emitted the same unrelated `friend.lowUserId`/`highUserId` drift the member-messages task removed (its decision 8); it comes from this worktree's database, and was removed from all three migrations.

## 10. Provider errors: failed only when the error proves the send didn't go out

REQUIREMENTS.md 11 asks for this; `EVIDENCE.md`, "Provider errors that prove a send didn't go out", has the research.

- `server/src/utils/send-error.ts` sorts a failed send into `SendErrorKind`: never handed over, refused, refused for now, or unknown. `mailSendError` is the waitlist's error sorting, moved; the waitlist maps each kind to the status it gave before. Recognition records `textFailedAt` or `emailFailedAt` for every kind but unknown, and leaves an unknown channel started with no outcome, which its reservation (decision 3) keeps from being resent and ALL-2298's filter shows.
- A temporary refusal, such as a Twilio 429 or an SMTP 4xx, is recorded failed, not retried, as before this change. Requirement 10 allows a resend once a send provably didn't go out but doesn't ask for one, and retrying would add a schedule nobody asked for.
- `MailService.sendMail` throws `MailUnrecordedError` when saving the outcome fails after the mail server answered the send. It carries none of the fields `mailSendError` reads, so it reads as unknown, and its message says the mail server answered, since staff see it as the uncertain recipient's detail. When the transport rejected the send, a failed save is logged and the transport's error rethrown, so a refusal still reads as one. Before, a lost database connection there carried `syscall: "connect"` and read as never handed over, so the waitlist would have resent the email; it now labels it uncertain.
- `MmsService.sendMms` turns a failed send into null, so `sendMmsResult` does the send and returns the kind, and `sendMms` wraps it; its other callers see no change. Every failure it returns still raises the SMS-failure alert, an unknown one included, since a hung or failing Twilio is an outage either way.
- `textSendError` reads a 429, a 401 or 403 refusing the account (agent judgement: the next text would meet the same), or a DNS or connect failure (Node's `syscall` on the error axios keeps as `cause`), as never handed over, and another 4xx carrying Twilio's error code as refused. TLS handshake failures, and a connect failing on every address of a host with several (an `AggregateError` with no `syscall`), also send nothing but aren't recognized: telling them apart isn't worth the code when reading one as unknown only leaves the send unresolved (agent judgement). Anything else is unknown: a 5xx, a reset, the 10-second deadline, a failed save after Twilio took the text, and any unexpected throw.
- A timed-out text that Twilio accepts later is saved as an `Mms` row by `recordLateSend` but not linked to its exposure. Linking it means a write after the run has moved on and marked the exposure delivered, outside the claim and any awaited path. The row carries the text's tracking id, whose tracking row names the action update and the member, so ALL-2298's evidence check can find it.
- No backfill. Rows recorded failed before this change kept no error, so a real refusal can't be told apart from an unknown outcome; they stay failed.
