---
user: chonboncode
task: The sign-up screen must refuse a referral code that resolves to nothing
---

## What the evidence showed

Measured against the running dev server and the local database:

- Registration through `createReferredUser` with an unused invite code succeeds
  (HTTP 201), so the invite path itself is not broken.
- The sign-up screen puts `referralCode` on both provider buttons, and it
  survives into the signed OAuth state the callback reads.
- No invite in the local database was consumed between 26 Aug and this
  investigation, so the failing attempts threw before `invalidateInvite` ran.
  That places the failure at `resolveReferral` returning null: the code does not
  exist in this database.

Rendering `/signup?ref=...` three ways:

- A spent invite hides the form and says the link has been used.
- A valid invite shows the form and names the inviter.
- A code that exists nowhere shows the form and both provider buttons, with no
  inviter line and no warning.

`useInvite` derives `used` from `invite?.status === "link_used"`, which is false
when the lookup 404s, so an unknown code is indistinguishable from a good one
until the server rejects it after the provider round-trip. `useInvite` and that
derivation arrived in PR #156, the new onboarding flow.

## Decision: refuse the code up front

`AGENTS.md` asks for loud failure, in these terms: a form should not render at
all where an error is detectable, or a user completes the normal journey without
realising anything is wrong. That is this defect exactly.

A code counts as unresolvable only when both lookups come back empty. Neither
alone is sufficient: `resolveReferrer` returns null for an invite with no
inviting user, and a campaign or personal referral code has no onetime invite
behind it.

## Not addressed

`resolveReferralCode` calls `invalidateInvite` before the user row is created,
outside a transaction, so a failure after that point spends the invite with
nothing to show for it. The local database holds 283 used invites against 214
claimed by a user. Left alone: it is a separate defect from the one reported,
and unpicking it means a transaction across the signup path.
