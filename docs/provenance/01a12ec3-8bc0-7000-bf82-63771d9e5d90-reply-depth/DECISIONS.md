## Decisions

- 6 over 10. Neither constant has a recorded rationale: web's 10 arrived with nested replies in July 2025, mobile's 6 with the mobile forum pages in January 2026. The local staging copy holds no thread deeper than 4. A thread seeded to depth 10 on post 15 reads well at 1280px on web at either limit. At 390px on web, the uncapped 40px indent leaves depth 6 a 120px column and depth 9 none. Shipped mobile builds already stop at 6, so 6 makes every client agree without waiting for app updates.
- `canReplyAtDepth(depth)` is exported rather than the constant: both callers ask the same yes/no question, and the comparison (`<` versus `<=`) belongs with the number.
- The mobile indent keeps its 72px cap as its own `MAX_INDENT_PX` constant, so changing the reply rule leaves the indent alone.
- Server enforcement is left out. The server has no depth rule to adopt, and enforcing one would need a parent-chain walk in `createComment` and the rule moved to `common/`. It is filed as a follow-up together with the uncapped web indent at phone width.
