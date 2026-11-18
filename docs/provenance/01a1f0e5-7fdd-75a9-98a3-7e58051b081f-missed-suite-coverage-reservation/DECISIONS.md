# Decisions

Builds on `docs/provenance/01a1dd1c-671e-76d3-8697-d491bf5e870e-cron-lease-locks/` (decision 6) and ALL-2237's coverage reservation for reminders (`docs/provenance/01a1e58f-2580-7098-8fee-732c8e7d9bd0-cron-overlap-member-messages/`). Every choice below is an agent decision; the method follows ALL-2293's proposed fix (agent proposal, filed during ALL-2237), whose points remain agent proposals, not requirements.

The user deferred how the fix behaves ("I don't care"), not whether it happens, on two choices; both are the agent's and a later agent may switch either if it causes friction:

- **When a missed-suite notice counts as reminding the member.** From reservation through sending, not only once a send is recorded as successful. A notice in flight to a member counts as reminder coverage on its member event, so a catch-up reminder group (`excludePreviouslyNotified`) in an overlapping run does not send that member a reminder about the same tasks. Apple's guidance against repeat notifications supports holding the catch-up back; treating the two message types as substitutes is agent judgement (EVIDENCE.md, "Overlapping messages").
- **When the delivery outcome is unknown** (a send threw partway, or the process died after reserving). The catch-up stays suppressed with no expiry, as reminders have since ALL-2237 and as the repository's other senders treat an uncertain send as sent (cron-lease-locks decision 6). This risks a member getting neither message after a crash. The alternative is a reservation that lapses after a set time (a TTL), the common practice for in-flight claims; adopting it means applying it to reminders as well (EVIDENCE.md, "Counting an unconfirmed send as sent").

## 1. A missed-suite notice reserves coverage like a reminder

`processMissedSuite`'s build takes the `reminder-coverage:<user>:<member event>` advisory lock and inserts its row with `deliveryPending = true`, as `processOne` does. The lock orders a concurrent catch-up's coverage read after the notice's insert commits, since `saveForLiveRecipient`'s row locks are `FOR KEY SHARE` and do not serialize the two runs. The pending flag keeps the notice counted while its delivery is in flight.

Only a personal cohort's notice that will be sent takes the lock, and only a notice that will be sent is pending. A member who gets no notice (no missed tasks in the suite, or a third consecutive miss) still claims the suite's key, but the row names no tasks and nothing settles it, so a pending flag would never clear.

## 2. The same release rules as reminders

A throw before the external send (building the in-app message, the in-app entry, rendering or preparing the channels) releases the reservation, unless a visible in-app entry was already saved: that entry has reached the member, so a failed write after it leaves the notice pending, counted like a throw while sending. A throw while sending leaves it pending, counted as a send that may have reached the member. A send that returns without reaching anyone settles through `recordDelivery` with `sent` as the in-app entry left it. If the in-app entry was visible, `sent` is already true, so releasing the flag leaves the notice counted.

## 3. The in-app link no longer settles the reservation

The write that links the in-app entry before the external send used `recordDelivery`, which clears `deliveryPending`. With a hidden in-app entry (`sent = false`), that would end coverage while the text or email is still in flight. The write now sets only `sent` and `notification`.

## 4. Shared helpers, and the worker's size

The lock is `lockReminderCoverage` in `save-for-live-recipient.ts`, beside the transaction both builds run in, and the release is the worker's `releaseReservation`; their extraction from `processOne` is its own commit, ahead of the fix. The fix took the worker past the repository's 500-line limit. A read-only codex subagent proposed splits. Its pick moves the missed-suite send path to its own service (worker about 300 lines). Its smaller option moves task lookup and keyword rendering to a new service, which means rewriting the worker's unit spec and five e2e call sites. This change instead moves `reminderTracking` into `action-event-notif-delivery.service.ts`, the service that takes it, and the lock helper as above, leaving the worker at 483 non-blank lines with no test churn. Splitting out the missed-suite path remains the better long-term boundary when the worker grows again.
