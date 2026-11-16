---
user: Alex Dorey
task: When the Safer Chatbots for Children project is Active, turn the waitlist page (/projects/safer-chatbots-for-children) into a home base for participants. Spec what the page looks like.
---

# Requirements

Terms: a **pair** is one simulated child talking to two AI chatbots, which a participant ranks. A **user-batch** is one participant's chunk of pairs with a closing date.

## Scope

- Applies when the KORA project status is Active, to everyone who sees the signed-in page today: waitlist participants and signed-in Alliance members get the same home base. (user-approved, agent-proposed)
- Pending and Closed keep their current pages. (user-originated: the request covers the Active state only)

## Removed from the Active page

- The heading "Thank you for joining the waitlist". (user-originated)
- The KoraBench subtitle ("Our partner, KoraBench, needs human reviewers…"). (user-originated)
- The "Remind me" toggle. A different reminder prompt may come later and is outside this spec. (user-originated)
- The yellow post-it with the black "Start reviewing" link. (user-originated)
- The rotating risk-category carousel. (user-originated: not kept when offered)

## Status-led top of page

- The heading is the participant's current ask, for example "Rank 7 more pairs by November 30", with a primary "Continue ranking" button (or "Start ranking" before any pair in that user-batch is ranked) linking to the review page. (user-approved, agent-proposed)
- A secondary line gives how many pairs the participant has ranked in total, for example "23 pairs ranked so far". (user-originated: tell participants how many pairs they have ranked; wording agent-proposed, user-approved)
- With nothing open to rank, the heading says "You're all caught up". (user-approved, agent-proposed)
- The page never shows the total left across the whole project or batch; the ask is only the current user-batch, sized to be achievable (a participant told "10 to go" is willing to do it in chunks; "30 more to go" discourages them). (user-originated)

## User-batches and closing dates

- An admin sets a closing date on each KORA batch they release. (user-approved, agent-proposed)
- A batch is released when it is uploaded; its upload date is the "Released" date. No separate release date. (user-approved, agent-proposed)
- The existing 7-day inactivity release stays alongside closing dates: a user-batch's unranked pairs go back to the pool at its closing date or after 7 days without a save, whichever comes first. (user-originated: chosen over dropping the 7-day release)
- Each participant gets one user-batch from an open batch; finishing it offers another user-batch while pairs remain, with the same closing date. (user-approved, agent-proposed)
- The data and the page support several user-batches per participant, so the team can later give more to participants who have done a good job. Choosing participants by quality is a later spec. (user-originated; deferral user-approved, agent-proposed)

## Table of user-batches

- A table lists the participant's user-batches, one row each, with the date it was released and its closing date. (user-originated)
- Each row also shows progress, such as "4 of 10 ranked". (user-originated: tell participants how many they have ranked and how many more they are asked to rank)

## Example pair

- The page offers a very simple, fake example pair the participant can go through. (user-originated)
- The example is interactive practice: the real review tool with one fake pair, where nothing is saved. (user-approved, agent-proposed)
- The example is optional but prominent: offered first to participants who haven't ranked a pair yet, and reachable afterwards from a smaller link. It never blocks starting real pairs. (user-approved, agent-proposed)
