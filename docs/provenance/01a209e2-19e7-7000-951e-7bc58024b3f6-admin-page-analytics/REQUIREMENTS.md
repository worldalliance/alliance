---
user: Charles Lien
task: Track which admin panel pages staff visit, in PostHog, so the most visited pages can be found.
---

# Requirements

1. The admin panel sends page visits to PostHog, so its most visited pages can be ranked. (user-originated)
2. The admin panel records no session replays. (agent-proposed, user-approved)
3. Admin events are attributed to the signed-in staff member, identified by their user id, the same id the member site identifies them by, and every admin event carries the property `app: admin` so member-site insights can exclude admin traffic. (agent-proposed, user-approved)
4. The admin panel captures page views and page leaves, each carrying the route template (such as `/forms/:formId`) in place of the visited URL, so pages group together and record ids and search terms stay out of PostHog. Query strings are stripped and click autocapture is off. (agent-proposed, user-approved)
5. The admin panel also sends uncaught errors and unhandled promise rejections to PostHog, but not console errors, whose messages in admin can carry member data. It also sends errors React Router catches and shows on its error boundary, such as a loader's or a render's, through React Router's `onError`, with the same staff-only attribution and URL scrubbing as other admin events, skipping expected not-found errors: route error responses, and admin's loaders' plain `Error("Not found")`. (agent-proposed, user-approved)
