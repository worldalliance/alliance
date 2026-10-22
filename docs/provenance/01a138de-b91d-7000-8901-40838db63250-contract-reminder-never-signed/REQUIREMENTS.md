---
user: Charles Lien
task: Specify and implement the never-signed agreement reminder email
---

## User-origin requirements

- Specify and implement the never-signed agreement reminder email.
- The variant's name substitution has the same behavior as the control: use the first whitespace-separated word of the trimmed account name, with no added fallback for an empty name. The salutation remains the supplied variant's `Hi`, versus the control's `Dear`.

## User-supplied design

- Add an A/B variant of the reminder for accounts that have never signed the membership agreement. Delivery is email only, once per recipient address.
- Preserve the trigger: at the hourly check, the account is at least 24 hours old, has zero contract events, and its email address has no previously recorded contract reminder. Preserve the existing recipient-selection behavior.
- The variant links to the agreement page and uses the following copy.

Subject:

```text
The last step is entering into the membership agreement.
```

Body:

```text
Hi #{name},

You signed up for the Alliance, but did not enter into our membership agreement. Our project planning relies upon accurate participation expectations. Until you enter into the agreement, we cannot assign you tasks.

By signing, you are letting other members know they can count on you, just like you can count on them.

You can enter into the agreement here: #{link}

If you would like to learn more about the Alliance and why reliability matters before signing, you can watch this video: #{videolink}

Best,
The Alliance Team
```

## Agent-proposed, user-approved selections

### Destination and copy

- Resolve the variant's `#{link}` to `/membership` on the configured application host, retaining existing message-link tracking.
- Use the explicit subject above. It takes precedence over deriving the subject from the first sentence of the body.
- Resolve `#{videolink}` to `https://www.youtube.com/watch?v=fR7Upo0DlYs&t=125s`, retaining the start time of 125 seconds.
- Keep the control's subject, body, and `/tasks` destination unchanged. Its subject is `Sign your membership contract to participate in actions`, with this body:

```text
Dear #{name},

You signed up for the Alliance platform, but did not sign the membership contract. Please note that until you do, you will be unable to participate in Alliance actions.

The contract matters because the Alliance is built on reliability. We plan precise actions based on the number of committed members; every commitment tells us who we can count on.

By signing, you’re telling other members that they can count on you. Because they’ve signed, you can count on them too.

You can sign your contract in the tasks page: #{link}

If you’d like to learn more about the Alliance and why reliability matters before signing, you can watch this video.

Thank you for your interest in the Alliance.

Best,
The Alliance Team
```

In the control, `#{link}` resolves to the configured host's `/tasks` URL, with existing tracking. The words `this video` link to the same video URL specified for the variant.

### Experiment and measurement

- Assign each eligible account independently with equal probability to control or variant. Persist the assignment for this experiment, independently of other experiments, and reuse it on subsequent attempts.
- Record the copy version sent. Retain existing delivery, click, and contract-signing records so the experiment can be analyzed manually. Assignment or message preparation alone does not establish successful delivery.
- A new experiment reporting interface is outside scope.

### Delivery and scope

- Preserve suppression by recipient address across both arms. A recorded reminder blocks another attempt even when its status is pending or failed, or the mail record is soft-deleted. Adding delivery retries is outside scope.
- Preserve existing sign-in and onboarding routing. In particular, Google/Apple sign-in can route an unsigned account through onboarding even when `/membership` was requested.
- This change covers the reminder email. New agreement screens, changes to signing or task assignment, notification preferences, push, text messages, and in-app notifications are outside scope.
