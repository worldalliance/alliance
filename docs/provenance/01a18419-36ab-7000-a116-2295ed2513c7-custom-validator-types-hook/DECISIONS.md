## What the cache holds

`customValidatorCustomValidatorsAdmin` returns the kinds of validator (`CustomValidatorTypeDto`), built on the server from the `CustomValidatorType` enum, not saved validators. No client writes them: creating a validator saves a new row of an existing type, and `useCustomValidatorAdmin` already owns saved validators under `queryKeys.customValidatorAdmin(id)`. So the types get their own hook and key rather than joining that hook, whose cache is per validator id.

## The hook

`useCustomValidatorTypesAdmin` sits in `apps/admin/src/lib/` beside `useCustomValidatorAdmin`, under `queryKeys.customValidatorTypesAdmin()`. It keeps the old return shape, `{ validators, loading, error }`, so `CustomValidatorSelect` and `AddRuleMenu` change only their import.

`staleTime: Infinity`, as the module cache never refetched either: the list changes only with a server deploy. Unlike the module cache, a failed load isn't kept for the rest of the session; the next mount asks again. The admin app's default retries, which every admin query gets, keep a failing load in its loading state for a few seconds before the error shows.

The error text goes through `adminRefusalMessage` with the old fallback, "Failed to load validators", so a 5xx shows the fallback rather than framework text, as before, and so now does a request that never reached the server, rather than the browser's fetch error; a 401 shows the admin session-expired message, and another refusal shows the server's `message`.

## Tests

Each test renders with its own `QueryClient`, so the `resetCustomValidatorsCache()` calls go with the module cache. `CustomValidatorSelect.test.tsx` covers a remounted picker reusing the loaded types, the failure text, and a failed load asked again on the next mount.
