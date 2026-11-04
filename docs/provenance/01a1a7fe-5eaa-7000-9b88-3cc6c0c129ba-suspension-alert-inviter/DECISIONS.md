# Decisions

- The alert reuses `referralLabel` (`server/src/user/user.utils.ts`), the label the "signed their contract" alert already carries, so it reads `Suspending contract for <name> (invited by <referrer>). failure code <code>`. Reusing it keeps the two alerts' wording in step, and it also labels a campaign signup `(via campaign <campaign>)`; a member with neither gets no label. (agent decision)
- The worker loads referrers for all candidates in one query after `findUsersToSuspend`, rather than adding the relations to the cohort-wide active-user load that every suspension plan computation shares. (agent decision)
