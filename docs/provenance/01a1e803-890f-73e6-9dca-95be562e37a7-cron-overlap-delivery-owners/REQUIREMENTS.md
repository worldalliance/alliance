---
user: Charles Lien
task: Make a PR for ALL-2238, "Give cron delivery attempts an owner and stop older runs overwriting newer results", the next issue in the Linear project "Cron locks that hold no connection".
---

# Requirements

1. Open a pull request that resolves the Linear issue ALL-2238, "Give cron delivery attempts an owner and stop older runs overwriting newer results". (User-originated.)
2. Every question put to the user is backed by a research agent (authoritative sources online), a brainstorming agent (given little context, asked for 20+ maximally different ideas) and a second-opinion agent. Research outranks the second opinion and the implementing agent; where the implementing agent disagrees with the research, more subagents settle it before the user is asked. (User-originated.)
3. Every cron job stays correct with no lock at all: on today's advisory locks, and before any lease code (ALL-2236), two runs of a job at once never send a message twice or lose an update. (Agent-proposed via ALL-2238, user-approved.)
4. Each waitlist email send has an attempt owner, so a new run doesn't treat another run's in-flight send as dead and an old run can't overwrite a newer run's result. (Agent-proposed via ALL-2238, user-approved.)
5. A recognition text, email or push can't go out twice when a worker resumes after another run has taken over its expired row claim. (Agent-proposed via ALL-2238, user-approved.)
6. Task badges stay as they are unless a write where an older result overwrites a newer one turns up; if none does, the reason the overlap is harmless is recorded. (Agent-proposed via ALL-2238, user-approved.)
7. An older participant count (`action.usersJoined`) can't overwrite a newer one. (Agent-proposed via ALL-2238, user-approved.)
8. Cohort decisions, the MMS media copy and divergence logging are recorded as already safe, with the reason for each. (Agent-proposed via ALL-2238, user-approved.)
9. Each changed job gets an e2e test that runs it twice at once with the lock bypassed and shows no duplicate send and no lost update, seen to fail on the old code. (Agent-proposed via ALL-2238, user-approved.)
10. A text or email whose send outcome is unknown is never resent automatically, unless reliable evidence shows it didn't go out: the provider shows no such send, or our own records show we never handed it to the provider. Otherwise the send stays unresolved and is shown to staff, who may choose to resend it, accepting the risk of a duplicate. The staff view may ship in a separate pull request. (Agent-proposed via ALL-2238 and a later agent proposal, user-approved.)
11. In this pull request, a recognition text or email whose provider call errors or times out is recorded as failed only when the error proves it wasn't sent; any other error leaves it started with no recorded outcome, unresolved as requirement 10 describes. The waitlist and recognition delivery sort send errors through one shared helper, so the two can't drift. (Agent-proposed via ALL-2238's review, user-approved.)
