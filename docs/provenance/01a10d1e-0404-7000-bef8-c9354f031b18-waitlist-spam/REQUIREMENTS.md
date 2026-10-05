---
user: Charles Lien
task: Flag suspected spam waitlist entries, skip their email, and hide them by default
---

# Requirements

## Stated by the user

- The user noticed that the join-request spam regex disappeared when the waitlist was added. (The agent confirmed it: the organization waitlist merge, #323, deleted `server/src/join-requests/`, which held `isGibberishSpam`.)
- Add a spam marker to waitlist entries. Don't send an email to an entry suspected of spam.
- Don't show spam by default.
- Keep spam entries rather than deleting them, in case the regex matches a real user.
- Add a way in the admin panel to mark an entry as spam or not spam.
- Don't migrate existing rows. The user will classify them manually.
- Use an enum for the spam state. (The agent had recommended a boolean.)
- For hiding spam in the admin list, the user chose this option: the server filter is a plain field with no hidden default, and the admin page starts with spam filtered out. The agent had recommended the other option, where the server excludes spam unless the filter asks for it, which would also change existing saved cohorts.
- The agent may load the staging database into the local database and read it.
- The user asked whether an LLM-based check could be used instead.

## Agent proposals the user approved ("go with your recommendation")

- Flag an entry when its reason alone is one token of 12+ ASCII letters with at least 3 uppercase letters after the first character. Ignore the name. Never flag an entry without a reason.
- Give a flagged signup the same response as a real one: 200, personal code, browser cookie.
- Spam entries get no confirmation, link-request, or staff bulk emails.
- Marking an entry not spam doesn't send the confirmation it missed.
- Leave spam out of the public waitlist count and the organization entry count on the referral page.
- Don't block staff from mobilizing or inviting spam entries.
- Admin controls: a per-row icon toggle plus bulk "Mark as spam" / "Mark as not spam" actions. Visible spam rows are greyed out.
- No Slack posts for waitlist signups, spam or not.
- Run the check only when an entry is inserted. A re-submit with a known email already creates and sends nothing.
- Enum values `Clean`, `Suspected`, `Spam`, `NotSpam`, with existing rows defaulting to `Clean`.
- Filter field `spamStatuses` (multi-select). The admin page starts with `[Clean, NotSpam]` selected. Saved cohorts and admin metrics follow the filter.
- Staff can set only `Spam` or `NotSpam`.
- Leave the LLM check out of scope as a possible follow-up.
