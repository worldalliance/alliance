---
user: chonboncode
task: OAuth signup must enter the onboarding flow, not skip it
---

## Reported behaviour

Creating an account with Google auth and Apple auth skipped the onboarding flow
entirely.

## Required behaviour

- Creating an account with a provider must not skip onboarding.
- It must jump directly to the first step of onboarding, the four priorities.
- The animation at the start of onboarding is skipped: no growing container
  animation as the panel arrives.

## Scope

The user asked for this defect to be fixed. They did not state which of the
three provider outcomes their account hit, nor what should happen to a member
who already completed the agreement and signs in with a provider.
