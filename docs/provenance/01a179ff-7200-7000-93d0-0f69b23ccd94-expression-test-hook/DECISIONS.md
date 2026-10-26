## A query, not a mutation

`POST /tasks/testCustomExpression` changes nothing on the server: `TasksService.testCustomExpression` evaluates the expression against the selected user and every active-contract member and returns the counts. Its result is a read of member data keyed by its inputs, so it is a query keyed by `queryKeys.customExpressionTestAdmin({ expression, userId })`; it uses POST only to carry the expression in a body. Nothing else reads or writes that key, and no write elsewhere needs to invalidate it.

## The hook

`useCustomExpressionTestAdmin` sits in `apps/admin/src/lib/` as its own one-endpoint hook. It shares no cache with `useCustomValidatorAdmin`, which holds saved validators by id.

- The observer is disabled, and `run` starts the fetch through `queryClient.prefetchQuery` with the current input, as `useMissedActionsAdmin` keeps its costly read behind a click. A `refetch` from the observer would run the options the observer last committed, which can still name the previous user or expression in the render that enabled the button; `run` closes over the same render's input as the button.
- `retry: false`: a failed run sends one request, as the click handler did. Each run evaluates the expression for every active-contract member.
- The key carries the expression and user, so an edit or a newly picked user shows no result until tested again, as the editor's reset effect did, and a slow run for an earlier input lands under that input's key, not the current one. `gcTime: 0` drops an earlier input's result as soon as the editor moves off it, so returning to that input shows nothing either.
- The server leaves out `selectedUserResult` only when no user is sent; the hook throws "Missing selected user result." if it ever does, as the click handler did.

## The editor

The editor reads the result through the hook and the TODO lint disable goes. Its validation messages stay, held in local state that an edit or a new user clears. A failed run shows the server's message through `adminRefusalMessage` with "Expression failed to run." as the fallback, so a 400 still shows why the expression failed. A thrown non-HTTP error (a network failure or the missing selected result) now shows the fallback where it used to show its own message. A failed rerun hides the earlier result, as replacing the state did before.
