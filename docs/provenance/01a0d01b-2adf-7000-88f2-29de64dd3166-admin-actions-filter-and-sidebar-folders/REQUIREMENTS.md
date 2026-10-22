---
user: Alex Dorey
task: Replace the admin sidebar's action list with a filter on the /actions calendar, and reorganize the sidebar into folders
---

# Requirements

## Actions calendar

- On the admin `/actions` page, make the action list in the left sidebar obsolete so it can be removed, and focus on the action calendar list view instead.
- The square showing "Actions" in the calendar's top-left corner gets a dropdown filter: drafts, active, pending, completed, onboarding. The user asked whether more categories are worth adding ("+etc?").
- Move the sidebar's "Create" button functionality to a simple icon, right-aligned inside that same square.
- Give that "+" icon a green background, because the Create button used to be green and people will be looking for it.

## Sidebar

- Change the "Log out" text in the left sidebar to an icon.
- Pull all the links out of the "Extras" section and put them directly in the left sidebar.
- The user then asked for groupings of the former Extras links into collapsible folders ("Feeds" and "Media Upload" as examples), then for groupings that also include the main sections, before any code changed.
- Adjustments the user made to the agent's proposed layout:
  - "Stats" at the top, because it is the `/` homepage.
  - "Members" and "Groups" just above "Community".
  - The "Action Planning" folder just below "Actions".
  - Swap "Content" and "Activity".
- The resulting layout, which the agent proposed and the user approved with "yes, build it":
  - Stats, Actions
  - Action Planning: Priority, Scheduled Plans, Contracts
  - Activity: Live Invite Feed, Event Log
  - Invites & Sharing: User Invites, Invitation Message, Share Links, Share Targets
  - Members, Groups
  - Community: Welcome Queue, Staff Directory, Member Map, Clusters, Friend Graph
  - Outreach: Ambassador Program, Outreach Partnerships
  - Content: General Updates, Forum Posts, Image Upload, Videos
- The same approval covered three behaviors the agent offered: folders are collapsible, a folder opens automatically on one of its pages, and a collapsed folder shows the Outreach Partnerships red count.
- `localStorage` remembers which folders are open.
- The sidebar highlights the current page, e.g. "Actions" while on `/actions`, and likewise for the other pages.
