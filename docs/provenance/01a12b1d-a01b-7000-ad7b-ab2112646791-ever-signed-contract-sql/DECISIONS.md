## Decisions

- `sqlUserHasEverSigned` has no time bound. The invite-link admin's copy alone required `date <= now()`. Both places that write contract events (`ContractService`) date them `new Date()`, and staging held no future-dated contract events on 2026-10-11, so dropping the bound changes no counts.
- "First signed at" (`MIN(date)` in `getAmbassadorInviteStats` and `getMemberCompletionRetentionByCohort`, `getFirstContractSignedAt`) stays as written. The copies already agree, and each has its own query shape: a lateral join, a grouped query builder, and an ORM lookup.
- The invite funnel's signer count in `AnalyticsService` counts distinct users over `contract_event` with the query builder rather than testing each user, so it keeps its shape; it has no time bound either.
- In-memory checks over loaded `contractEvents` (analytics, cohort decisions) stay separate: they bound by caller-specific dates rather than restating this SQL.
