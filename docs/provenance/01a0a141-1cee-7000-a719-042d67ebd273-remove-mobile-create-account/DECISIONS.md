## Scope

Investigation found two signup surfaces in `apps/mobile`:

- `app/auth/signup.tsx`: a standalone "Create Account" screen, unreferenced from any navigation, link, or redirect anywhere in the app (likely left over from before the onboarding rewrite). Deleted.
- The onboarding gate (`app/onboarding/index.tsx` + `WelcomeGate`/`AccountFields`): the live entry point, with a "Create an account" toggle that switched an account-gate form between login and sign-up modes. `AccountMode` already defaulted to `LogIn`. Removed the toggle and the `AccountMode.SignUp` branch in `submitAccount`, so the gate is login-only.

Confirmed `authRegister` is also called from `apps/frontend/src/onboarding/OnboardingPage.tsx` (web signup) and that web onboarding does its own `contractSignContract` call, so web already covers full account creation including agreement signing independent of this change.

## Asked and confirmed with the user

- Whether the login-only gate should show a message pointing users to the web to create an account: user chose no message, just remove the option.
- Whether to also delete the onboarding narrative/agreement screens (`StorySteps.tsx`, `AgreementStep.tsx`, the `join()`/`contractSignContract` flow) that become unreachable through normal navigation once sign-up is removed (they're still reachable via the dev-only `?step=` param): user chose to leave them in place rather than delete, in case mobile sign-up is reintroduced later.

## Implementation choices

- Changed `accountMode` from `useState` to a plain `AccountMode.LogIn` constant in `app/onboarding/index.tsx`, since nothing sets it anymore. TS then narrowed its type to the literal `AccountMode.LogIn` and flagged the `accountMode === AccountMode.SignUp` branch in `submitAccount` as an impossible comparison, so that branch was deleted too, per "delete what your change orphaned."
- Removed the now-unused `onModeChange` prop from `AccountFields` and `WelcomeGate` (eslint's `no-unused-vars` flagged it once the toggle that called it was gone).
- Removed a comment in `AccountFields.tsx` that referenced the now-deleted standalone signup screen's email regex.
