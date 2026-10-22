---
user: chonboncode
task: The sign-up screen must refuse a referral code that resolves to nothing
---

## Reported behaviour

Creating an account with Google auth on localhost fails with "You need an invite
link to create an account" after the provider round-trip completes.

The user reports using the same methodology for creating test reference codes as
they have in the past, and states the onboarding work introduced bugs that break
account creation.

## Required behaviour

- Account creation must work.

## Not stated by the user

The user did not say which referral code they used, nor how they produced it.
