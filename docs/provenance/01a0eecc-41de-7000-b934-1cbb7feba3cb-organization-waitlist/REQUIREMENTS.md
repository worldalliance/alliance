---
user: Charles Lien
task: Organization waitlist, admin mobilization, and integration with the Democratic Grantmaking page
---

## Scope and provenance

The user requested a specification before implementation. Cover the complete supplied project-page document, while prioritizing backend/admin work and connecting the existing page on this branch. Write no application code in this task.

The statements under “User requirements” originate in the user's document or interview. The separate approval section records selections of agent proposals; their origin remains agent-authored. Email-abuse recommendations belong only in DECISIONS.md, at the user's explicit request.

## User requirements

### Waitlist and ordinary signup

- Store waitlisted people separately from accounts. Joining the waitlist does not create an Alliance account.
- The waitlist has no Google or Apple entry; people join with name and email.
- The waitlist is a special entry path and must not gate existing normal invite flows. Mobilization sends a normal signup invite usable by someone who is not on the waitlist. Avoid introducing a new account signup flow.
- Mobilized means accepted off the waitlist and free to join the Alliance, regardless of whether the person creates an account.
- Waitlisted people need personalized links for inviting others and a way to retrieve those links after leaving the site. Remember their state locally when they return, and remember an earlier signup invite/code as well.
- Personal waitlist referrals inherit the inviter's organization and track who invited whom. Waitlist entries do not have accountability groups.
- Remove the existing Request to Join page. Update all on-site links formerly targeting `/join` to the Democratic Grantmaking waitlist page. A redirect for old `/join` URLs is acceptable but not required by the user.
- Require a reason for wanting to join when the entrant has no organization, including personal referrals from someone without an organization. Organization-attributed entrants skip it.

### Organizations, groups, and links

- An organization is a third party such as a company or foundation, stored in the database. A group is the existing `Community` accountability-group concept.
- Organizations need multiple links, potentially including one-time invites, but do not need independently managed campaigns within each organization.
- Each organization has one accountability group; a group cannot be tied to multiple organizations. Staff assign leaders in admin.
- An organization may collect entries before its group exists. Warn staff before emailing when no group is assigned.
- Channel distinguishes an organization's links, such as its social-media and newsletter links. Track each link separately.

### Admin operations

- Staff can select any subset of waitlist entries and send custom email. Support sorting by joining time and organization, additional useful filters, and manual tags.
- Cohorts are sets of filters. Tags are manually maintained sets of people and do not gain members automatically.
- For non-mobilized entries, provide “Send email” and “Send email and mark as mobilized.” Mobilized entries can still receive email.
- Mark recipients mobilized only when their email is successfully sent. Allow staff to mark entries mobilized independently, undo that status, and accommodate email sent outside the application.
- Require confirmation before sending real email. Prefer confirmation warnings for questionable admin actions rather than unnecessarily preventing them.
- Include an “Invite claimed” category/filter distinct from mobilized status.
- Support editable email templates using the repository's `#{variableName}` placeholder syntax.
- Defer scheduled mobilization, global relative-time notifications, automatic followup sequences, and a general notification-rule framework. Staff can perform followups ad hoc.

### Page and full-document coverage

The supplied document describes a public Democratic Grantmaking page that explains Alliance membership and collects name, email, and a required commitment checkbox. It calls for a viewport-sized initial signup area, the project title, an advisor mention, pilot/process/assessment explanations, and additional detail below.

Referral presentation includes a person or organization inviter. For an organization, use its logo where available; below three attributed entries say that the organization invited the visitor, and from three entries say “Join N others from ORG NAME.” Show member and waitlist progress.

Confirmation needs a success message, next steps, and a personal sharing link. The user approved a basic functional confirmation for the designer to revisit. Public-facing copy, identities, layout, and visual polish remain designer-owned.

The original document also requests link/organization signup metrics, invitation-to-claim rate and time, claim-to-contract-to-first-action conversion, and the rate of joining the waitlist. Keep the initial metrics simple; more can be added later.

The original mobilization outline describes action-aligned batches, an initial invitation, reminders after days and weeks, group-lead outreach, a final pre-project invitation, and results outreach. Preserve these as possible manual operational uses; their timing and automation are deferred by the interview.

## Approved agent proposals

The user approved the following agent-authored recommendations; implementation interpretations and rationale are in DECISIONS.md.

- Represent an organization as a campaign kind, with an optional group, preserving ordinary campaigns. Allow many reusable organization/channel waitlist links and personal waitlist links. Use an individual single-use normal signup invite for each mobilization recipient.
- Track conversion through the emailed invite and its claiming account instead of matching waitlist and account emails. A forwarded invite attributes its actual claimant; an unrelated signup is not detected.
- Reuse a recipient's unused invite in followups. Make replacement explicit. Keep undoing mobilized status separate from revoking an unused invite.
- Warn about a missing/full/unavailable destination group and allow staff to proceed; affected accounts await staff placement rather than being blocked from signup.
- Keep one waitlist entry per normalized email. Duplicate submissions retain the first organization/referrer and mobilized status. Entry itself does not require email verification.
- Retain every sent message with a reuse action; save named templates explicitly. Templates contain a subject and formatted body, with name, organization, signup-link, and personal-share-link substitutions. Editing a template affects future drafts.
- Filter/search by name/email, organization, source link/channel, referrer, signup date, tags, mobilized status, and invite-derived account status. Allow individual selection and all filtered results. Staff can read the reason and filter for its presence.
- The public waitlist count includes non-mobilized entries. Organization social proof counts cumulative attributed waitlist entries, including personal referrals and mobilized people.
- Remember waitlist state and opened signup invitations for 30 days using secure browser cookies, with a “Forget this browser” control. Explicitly opened invites take precedence over remembered ones. Used/revoked invites cease offering signup. A waitlist cookie alone cannot reveal a subsequently issued signup invite.
- Include unsubscribe in waitlist emails and exclude unsubscribed recipients from bulk sends. Staff can contact people separately where appropriate.
- Store an optional manually editable publication date per organization link, separate from its creation date and channel label; this is tracking metadata, not scheduling.
- Count first completed action, including onboarding actions, for the first-action metric. Measure time to claim from the first successful mobilization email to account creation through its invite. Label conversions as invite claims.
