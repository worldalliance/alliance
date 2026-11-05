# Decisions

- The alert names the member through `memberWithReferral` (`server/src/user/user.utils.ts`), which the "created an account", "signed their contract" and self-suspension alerts also use, so they can't drift apart. It reads `Suspending contract for <name> (invited by <referrer>). failure code <code>`. It also labels a campaign signup `(via campaign <campaign>)`; a member with neither gets no label. (agent decision)
- The worker loads referrers for all candidates in one query after `findUsersToSuspend`, rather than adding the relations to the cohort-wide active-user load that every suspension plan computation shares. (agent decision)
