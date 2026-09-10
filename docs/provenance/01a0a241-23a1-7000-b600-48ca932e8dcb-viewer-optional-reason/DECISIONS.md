## Wire shape

- `UserActionStatus.optionalReason: ViewerOptionalReason | null`, next to `optional`. Non-null only where `optional` is true and `Action.optional` is false. The server sends `null` everywhere until the rule that widens `optional` lands, and that rule sets the reason alongside the flag.
- `UserActionStatus` accepts a non-null reason only alongside `optional: true`, so a rule that sets the reason and forgets the flag fails to compile. Deriving `optional` from the reason inside the resolver would enforce more, but until that rule exists it means branching on a reason that is always null. It waits for the rule.
- One variant, `ContractGap` (`contract_gap`), for a member whose contract missed part of the member-action window, the only widening planned.
- The field lands in its own commit before any client reads it, so every commit deploys alone.

## Client

- Whether an action is optional for the viewer alone still comes from the flags (`viewer.optional && !action.optional`). The reason only picks the explanation. A widened flag with a missing or unrecognized reason gets wording that says it's optional for you without saying why. That's the path an installed app takes when a newer server sends a reason it doesn't know.
- The action page picks its header from a static per-state map, so each piece of wording is its own panel state: `OptionalForViewer` (no reason) and `OptionalForContractGap`. `getViewerOnlyOptionalReason` in `actionUtils.ts` folds a missing or unknown reason into `Unknown`, so that fallback lives in one place. The action page maps its result to a panel state and the home banner maps it to copy, so the home card never imports the page's states.
- The two contract-gap sentences differ in tense on purpose. The action page shows its sentence only before the deadline, since the missed-deadline state comes first, so it says the task "has been open". The home banner also shows after the deadline, so it keeps "was open".
- Both sentences describe time the task has already been open, but neither surface checks that it has. Before the phase opens the deadline check is false, so a `contract_gap` reason would still show. The rule that widens `optional` sets `contract_gap` only once `memberActionStarted` is true.
