## Which calls move

Of the onboarding screens' raw calls, only `contractSignContract` writes something a cache holds: signing changes the member's `hasActiveContract` and `lastContractEvent` (the `authMe` cache) and `firstContractSignedAt` (the visibility-context cache). `authRegister` and `authForgotPassword` are auth calls that touch no cache, so they keep the lint disable, now stating that reason instead of a TODO.

## The hook

`useContractSignature` in `shared/lib` owns every contract write by a member and what it reloads: `sign` refreshes the member and invalidates the visibility context, and `suspend` refreshes the member only, since suspending doesn't move `firstContractSignedAt`. Both return a `Result` carrying what the client threw, so each caller keeps its own message for a failure.

`useMembershipAgreement` already signed and suspended directly, refreshing the member through a `refreshUser` parameter. It now goes through the hook, so its writes and the onboarding screens' share one place, and the parameter goes.

## Effect on mobile

Mobile signs after `login` has already loaded the member, so the cached member kept `hasActiveContract: false` after joining. The hook's refresh corrects it. The web page loads the member again in `onLogin` after signing, so the refresh there costs one extra request.

## File size

`OnboardingPage.tsx` sat at 500 lines, so its panel moves to `OnboardingPanel.tsx` in its own commit first, along the split `codex exec` recommended as the lowest-risk one.
