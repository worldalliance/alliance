# Evidence

## The failure

Method: `gh run view 43479797083 --log-failed` (Deploy on `41831f4bb3`, 2026-11-13), and local runs with bun at `41831f4bb3`.

- `test-unit (apps/frontend)` failed all three tests in `src/site/DocPage.test.tsx` with `UnroutedRequest: unrouted request: GET /user/onetimeInvite/good`. The same tests passed on the PR run of #985, and the full suite passes locally: only CI's file order exposed it.
- In that run's order, `src/onboarding/OnboardingPage.test.tsx` ran 33 files before `DocPage.test.tsx`. Its last two tests set `sessionStorage["alliance:invite"]` to `{"explicit":null,"saved":"good"}` and nothing clears it. `DocPage.test.tsx` renders `InviteSessionProvider`, which loads that code and fetches the invite, and routes only `GET /contract/current`.
- Reproduced locally: prefixing a copy of `DocPage.test.tsx` with that `sessionStorage.setItem` fails its three tests with the same error.
