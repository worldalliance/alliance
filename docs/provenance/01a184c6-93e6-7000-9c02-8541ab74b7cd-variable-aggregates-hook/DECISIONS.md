## The query

`useVariableAggregates` keeps its signature and its `VariableAggregates` result, so `useFormInputs`, the mobile `FormRenderer` and `variableInputsGate` don't change. The query is keyed by the target and the de-duplicated questions, as the old load was, so an admin preview whose counted questions change loads again and never shows the previous set's counts.

The aggregate-inputs record asks for counts fetched when a form opens, held still while it stays open, and fetched again on reopen, with no persistent aggregate cache. So the query is `staleTime: Infinity`, which keeps a window refocus or reconnect from swapping counts under an open form, and `gcTime: 0`, which drops the entry once no form shows it, so the next open loads fresh counts behind the loading state rather than showing old ones first.

`retry: false`: a failure already shows the form's retry control, which calls the query's `refetch`, and the apps' default retries would only hold the form in its loading state first, as the old load never retried.
