---
user: Charles Lien
task: Normalize shared action and notification state, and assess further entity migrations
---

- User requirement: Data representing the same action should stay consistent across list and detail endpoints and their consumers.
- Agent-proposed, user-approved: Pilot a normalized action store while retaining TanStack Query for requests. Verify list loads, detail loads, mutations, delayed responses, and session changes.
- User requirement: Explore other entities that would benefit from normalization, including notifications and notification counts, and recommend further migrations.
- User constraint: Treat the cost of writing boilerplate as negligible because agents perform most repository edits.
- User requirement: Migrate notifications to normalized records next, so the bell, home row, and notifications page (web and mobile) show the same state for the same notification.
- User requirement: The action pilot is not a template to copy exactly. Improve it where the next migration shows a need.
- User preference: Where the user leaves a choice open, prefer what makes the platform smoother and the code higher quality.
- User requirement: Migrate activities to normalized records next, including the forum comments that appear in the home and profile feeds, so every activity list, feed, and activity detail screen (web and mobile) shows the same state for the same activity or comment. Open a PR for it.
- User requirement: Migrate forum posts to normalized records next, so the forum index, post detail, and user-profile post lists (web and mobile) show the same state for the same post. Track it as Linear issue ALL-2023 and open a PR for it.
- Agent-proposed, user-approved: Migrate communities to normalized records next, so My Groups and the public groups list (web and mobile) show the same state for the same group. Track it as Linear issue ALL-2057 and open a PR for it.
- Agent-proposed, user-approved: Migrate conversations to normalized records next, so the Messages list and a group's chat (web and mobile) show the same state for the same conversation. Track it as Linear issue ALL-2062 and open a PR for it.
