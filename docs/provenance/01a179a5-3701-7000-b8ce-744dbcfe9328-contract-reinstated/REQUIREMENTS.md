---
user: Charles Lien
task: Specify agreement reinstated notifications
---

# Agreement reinstated

## Scope

Origin: user-originated; exact copy and notification-only scope are agent-proposed, user-approved selections.

Notify the reinstated member by push, in-app, text, and email according to their preferences. Use the copy below without A/B testing. Keep task assignment, participation accounting, signing permissions, and group restoration behavior unchanged.

## Trigger

Origin: agent-proposed, user-approved.

Send once per successful transition from a suspended agreement to a signed agreement, however the agreement was suspended: a voluntary pause, an admin suspension, or an automatic suspension. Cover all existing signing paths, including signing through a task form. Exclude first signing and signing or switching agreements while already active. A later suspension followed by another reinstatement qualifies again.

Begin delivery immediately after the successful reinstatement has committed. Apply to future reinstatements after launch only; do not backfill historical events. Duplicate or concurrent processing of the same transition must not create another notification or external send attempt.

## Preferences and destinations

Origin: user-selected separate per-channel settings; setup and destinations are agent-proposed, user-approved.

Expose an “Agreement reinstated” row under Actions in web and mobile notification settings, with independent in-app, push, text, and email controls. Each channel initially inherits the member's channel default and permits an explicit override. Support the row through existing admin preference controls. Apply existing channel reachability and unsubscribe restrictions.

All notification taps and message links open the tasks page on the relevant platform.

## Copy

Origin: user-originated; first-name personalization is agent-proposed, user-approved.

Push and in-app:

```text
Your agreement has been reinstated.
```

Text:

```text
Your agreement has been reinstated. Task assignment resumes with the next action. #{link}
```

Email subject:

```text
Your agreement has been reinstated.
```

Email body:

```text
Hi #{name},
Your agreement has been reinstated. Task assignment resumes with the next action, and your participation is counted in action planning from this point.
#{link}
```

Replace `#{name}` with the member's first name using existing personalization behavior. Replace `#{link}` with the tasks-page link.

## Failure and stale delivery

Origin: agent-proposed, user-approved.

Match suspension's best-effort delivery: attempt enabled, reachable channels independently, log failures, continue other channels, and do not retry failed delivery. Notification failure must not undo reinstatement or turn a successful reinstatement into an error for the member.

Before dispatching pending delivery, skip it if its reinstatement is no longer current. A subsequent suspension, from any cause, invalidates pending delivery from that reinstatement, even if another reinstatement follows. Already delivered messages remain.

## Acceptance checks

Origin: agent-derived checks for the approved behavior above.

- Exercise every suspension cause and every signing path; each qualifying transition produces one notification opportunity, while first signing and active-agreement changes produce none.
- Reprocess a transition and race duplicate requests; observe no duplicate entries or external attempts. A separate later reinstatement still qualifies.
- Verify inherited defaults and explicit overrides independently for all four channels, including in-app disabled with push enabled; verify web, mobile, and admin settings support.
- Verify all copy, first-name substitution, and tasks destinations, including mobile navigation.
- Fail each channel independently; reinstatement succeeds, other eligible channels proceed, failures are logged, and failed delivery is not retried.
- Suspend again before dispatch, including a suspension followed by another signing; old pending delivery is skipped and delivered entries remain.
- Confirm launch sends no notifications for reinstatements before launch and does not alter assignment or participation rules.
