---
user: chonboncode
task: OAuth signup must enter the onboarding flow, not skip it
---

## What was actually broken

`OnboardingPage` branched on the three `OAuthOutcome` values and only routed
`SignedUp` into the flow. Verified in a browser against the running dev server:

- `?google=signed_up` reaches `?step=community` with `ob-panel--instant`, which
  is the behaviour the user asked for. It was already correct.
- `?google=signed_in` ran `navigate(redirectAfterLogin)`, which leaves for
  `/tasks` and skips the flow.
- `?google=linked` fell through to a bare `return`, leaving a now-authenticated
  member sitting on the sign-up form.

The server decides the outcome in `OAuthAuthService.authenticate`: an existing
`OAuthAccount` gives `SignedIn`, an existing user matched by email gives
`Linked`, and only a genuinely unknown email gives `SignedUp`. Creating an
account with a provider therefore returns `Linked` whenever a user row already
exists for that address, which covers an invited member whose partial profile
was pre-created, and anyone on staging whose address came over in the nightly
production sync.

## Decision: route on whether the member owes the agreement

Assumption, not stated by the user: a member who has already entered the
membership agreement should go to the platform rather than be walked through
onboarding again.

All three outcomes leave the member signed in, so the outcome itself does not
say where they belong. `user.hasActiveContract` does. The handler now asks
`authMe` and sends anyone without an active contract to the priorities, and
everyone else on to the platform.

`hasActiveContract` is the user's latest contract event being `SIGNED`, not a
check against the current contract version, so publishing a new contract does
not flip it false for existing members and cannot sweep them back into the flow.

Branching on the outcome enum is gone rather than made exhaustive: the decision
no longer depends on which of the three fired.

## Decision: a failed `authMe` falls into the flow

The flow is the safer landing. `registeredRef` is set first, so a member who
lands there does not re-register; they sign the agreement and continue.
