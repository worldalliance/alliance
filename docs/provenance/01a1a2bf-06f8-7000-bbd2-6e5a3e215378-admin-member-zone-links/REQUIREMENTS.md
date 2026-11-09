---
user: Alex Dorey
task: Link between the member app and the admin panel
---

# Requirements

- Admins see a settings icon at the bottom left of the member app that opens the current page's counterpart in the admin panel. Origin: user, via commit `7af6587fb` on `dorey/scratch`; the original request is not recorded.
- The member-side link is on the web member app only; the mobile app gets no admin-panel link. Origin: agent-proposed, user-approved.
- The admin sidebar has a house icon at the bottom left that opens the current page's counterpart in the member app. Origin: user, via commit `7af6587fb` on `dorey/scratch`; the original request is not recorded.
- Each of the two icon links shows a tooltip naming where it goes: "Open in admin panel" on the settings icon, "Open in member zone" on the house icon. Origin: user, from a review of PR 915.
- The admin origin is `admin.` on the app's domain in production, and this checkout's admin port in development. Origin: user, via commit `7af6587fb` on `dorey/scratch`; the original request is not recorded.
- From a member's profile page (`/member/:id`) the settings icon opens that member's page in the admin panel (`/member/:userId`), and from there the house icon returns to the profile. Origin: user.
- The settings icon and the helpers it needs ship in the member web app (`apps/frontend`, `sharedweb/`, `common/`) on the same branch as the admin changes. Origin: user.
- Land this on `main` as its own commit, with the message `admin-member-zone-links`. Origin: user.
