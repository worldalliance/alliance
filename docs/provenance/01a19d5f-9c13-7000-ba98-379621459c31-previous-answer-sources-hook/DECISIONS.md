## The queries

`usePreviousAnswerSources` keeps its signature and its result, so `useFormInputs` and `useMobileFormState` don't change.

One query per source form, through `useQueries`, reading the form's schema and the response together, since a source is only useful with both. The key holds the mounted hook instance, the preview member, whether anyone is signed in, and the form, so a late answer for a member an admin switched away from lands under that member's key and never shows, and a source form added while the form is open loads only itself.

The sources follow the policy of the aggregate counts and source histories beside them (see `01a184ea-…-variable-source-histories-hook`), through `openFormQueryOptions`: held still while the form is open, loaded afresh when it reopens, never retried on their own, and failed rather than paused offline. The instance in the key keeps each open form's sources its own, for the same reason: a form opened while another reading the same source stays open loads afresh rather than showing answers loaded before a submission.

`combine` builds the result, so it keeps its identity until a query's state changes.

## Behavior that changes

- A schema edit that leaves the source form ids alone no longer refetches. The old effect ran on every new `schema` object, which in the admin builder's preview meant every edit; the query keys hold only the ids, as in `useVariableSourceHistories`.
- On web and admin, a failed load refetches when the window regains focus or the device reconnects, TanStack's default for a query with no data, so a form held on a failure can recover. The old load held until the form reopened. On mobile only reconnect could trigger it, since `apps/mobile/lib/queryClient.ts` sets `refetchOnWindowFocus: false`, and the app wires no `onlineManager` listener, without which TanStack sees no reconnect in React Native, so a failed load still holds until the form reopens. `previousAnswersPending` stays set throughout, so nothing is judged by answers it lacks.
- While a form's response has failed its schema is withheld as well. Neither display reads a schema without answers: `resolvePreviousAnswer` shows the placeholder either way.
- A failed load logs to the console, as `useVariableSourceHistories` does. The old load failed silently.
- Sources appear as each lands rather than all at once. The old load already showed a partial result with `previousAnswersPending` set after a failure, so readers handle that state.
