# Decisions

- Add an automatically reachable `implement` skill, pointed to by `AGENTS.md`, so implementation tasks receive the procedure without requiring an extra user invocation. It also covers bug fixes and refactors, where reuse and contract checks matter.
- Move the engineering criteria from `review` to a plain shared document read by both skills. Keep repo-wide coding rules in `AGENTS.md` and review evidence, independence, tiers, and output rules in `review`.
- Require a short discovery update with concrete code owners, callers, contracts, and checks. This makes reuse investigation observable before editing without creating another approval stage or mandatory artifact.
- Keep provenance routing inside implementation and reuse a supplied task directory. Preserve specification and independent-review handoffs and leave the experimental runner unchanged.
- Validate instruction routing, formatting, and skill metadata. Prompt changes need observation on real tasks before claiming they reduce review rounds.
