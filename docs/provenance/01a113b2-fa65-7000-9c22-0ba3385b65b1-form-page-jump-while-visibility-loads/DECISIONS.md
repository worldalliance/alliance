# Decisions

- **Cause.** Until another form's answers load, page conditions reading them evaluate as unmet. Reproduced locally for action 162: a member reloading on page 2 was moved to page 5 by the effect that leaves a hidden page, and a member clicking Next on page 1 before the answers loaded was sent past pages 2–4. Either way the jump was saved to localStorage and kept on later visits.
- **One "settled" rule, reused.** `useFormVisibility` already decided when its inputs were settled (no input loading or failed, every referenced validator verdict present) before dropping unoffered choices. That expression is now `visibilitySettled`, returned from the hook and used by the hidden-page fallback and by Next, so all three wait on the same condition.
- **Next waits; it doesn't guess.** While unsettled, Next is disabled and its handlers return early, on web and mobile. On web, pressing Enter mid-form goes through `submitCurrentPage`, whose move-to-next-page branch waits too. Final submission is unchanged.
- **A failed input keeps Next disabled.** Failed inputs count as unsettled, as they already did for dropping choices. Moving on would land the member on the wrong page, as in the reported bug, and refreshing retries the fetch.
- **A member already stuck on a later page stays there.** The fix stops new jumps; it doesn't rewrite stored page indexes. Previous takes the member back.
