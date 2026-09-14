---
user: Alex Dorey
task: Make the outbound mail sender an env var and record mail rows when a send fails
---

Follow-up to a review of commit `8f7bb7828` ("changing email sender to thealliance.org"), which moved the hardcoded `from` on all outbound mail to `alliance@thealliance.org` and added a `dirty.txt` entry to hold the production deploy. The review was agent-authored; the items below are the user's responses to it.

## Confirmed by the user

- The new sender `alliance@thealliance.org` is registered under Sign in with Apple > Email Communication in the Apple developer portal. This closes the review's `apple-relay-registration` finding, which flagged that an unregistered sender would silently stop reaching Hide My Email relay addresses. No code change needed for it.

## Requested

- Fix the review's `unsaved-mail-on-failure` finding. As stated in the review: when the mail transport rejects, `MailService.sendMail` throws and no `Mail` row is persisted at all, because the only `save` on the sending path is the last line of the method. The review also noted that `auth.service.ts` awaits `sendWelcomeEmail` with no try/catch after the user row is already committed, so a mail failure returns 500 from registration and the retry hits "User already exists".

- Fix the review's `hardcoded-sender` finding. As stated in the review: the sender address is a code constant while the SMTP credentials that authorize it are GitHub secrets, so the two halves change in different places. The review's proposed fix was a `MAIL_FROM` env var added to `server/.env.example` and `deploy.yaml` alongside `SMTP_USER`.

- Add the GitHub secrets edit that this requires to `dirty.txt`.

## Not requested

The review's other findings — `reply-destination`, `failed-event-unmapped`, `dirty-txt-undocumented`, `commands-txt` — were not asked for and are out of scope.
