---
user: markzxu
task: make onboarding actions display the current number of signed contract members instead of the number of people that have completed the action
---

- Onboarding actions display the current number of signed contract members in place of the number of people who have completed the action. User-originated.
- The onboarding action label reads "N members" (for example "1200 members"), with no "completed". User-originated.
- On web and mobile, an onboarding action's completed bar draws full and is labelled "... members" while the count loads, so nothing shifts. If the request fails, the bar is empty and labelled "Member count unavailable". Agent-proposed and user-approved.
- The web `ActionLink` hover preview hides its member count line while the count loads and when the request fails, since it has no layout to protect. Agent-proposed and user-approved.
- The change to `signedMembersCount` ships in this task's PR, as its own commit. Agent-proposed and user-approved.
