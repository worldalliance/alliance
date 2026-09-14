## Wire shape

- `UserActionStatus.optionalReason: ViewerOptionalReason | null`, next to `optional`. Non-null only where `optional` is true and `Action.optional` is false. The server sends `null` everywhere until the rule that widens `optional` lands, and that rule sets the reason alongside the flag.
- `UserActionStatus` accepts a non-null reason only alongside `optional: true`, so a rule that sets the reason and forgets the flag fails to compile. Deriving `optional` from the reason inside the resolver would enforce more, but until that rule exists it means branching on a reason that is always null. It waits for the rule.
- One variant, `ContractGap` (`contract_gap`), for a member whose contract missed part of the member-action window, the only widening planned.
- The field lands in its own commit before any client reads it, so every commit deploys alone.
