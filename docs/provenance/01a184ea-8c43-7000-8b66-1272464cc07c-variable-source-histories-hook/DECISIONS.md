## The queries

`useVariableSourceHistories` keeps its signature and its `SourceHistories` result, so `useFormInputs`, the mobile `FormRenderer`, `variableInputsGate` and `useFormulaSourcesRefetch` don't change.

One query per source form, keyed by the subject (the signed-in member, or the member an admin reviews), the form and the caller's `reload` count, through `useQueries`. A source form added while the form is open loads only itself, a late answer for a member an admin switched away from lands under that member's key and never shows, and bumping `reload` moves every form to a fresh key, showing loading until each lands, as the old load did. Nobody's and a pending subject's histories run no query.

The histories follow the same policy as the aggregate counts beside them (see `01a184c6-…-variable-aggregates-hook`): held still while the form is open, loaded afresh when it reopens, never retried on their own, and failed rather than paused offline. Both hooks take that policy from one `openFormQueryOptions`, so it changes for both together.

Retry refetches every errored query, a deleted source form's included, as the old retry dropped every unsuccessful result. A failure a retry may clear still outranks a deletion none can.

`combine` builds the `SourceHistories`, so the result keeps its identity until a query's state changes and `useFormRenderer`'s memos don't recompute each render.

Two open forms reading the same source form for the same subject now share one load, where each loaded its own before.
