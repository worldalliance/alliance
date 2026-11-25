---
user: chonboncode
task: Try a new display for action updates on the tasks page across web and mobile, showing one update at a time in a swipeable slideshow, and show updates on mobile at all.
---

# Requirements

- The tasks page, on web and mobile, shows the current task card first, then updates, then activity. (user-originated)
- On mobile and on web below the desktop width, the update cards sit in a horizontal row of large cards, one in focus with the next peeking in, after the user's Strava race-card reference. (user-originated)
- On desktop, the right sidebar shows three update cards at once, stacked: the newest three, with "See all" above them. They replace the Alliance-wide activity list that was there. (user-originated, choosing among agent-proposed options)
- On desktop, the main column has no updates section; updates appear only in the sidebar. Mobile and narrower web windows keep updates in the main column. (user-originated, choosing among agent-proposed options)
- Updates change with a horizontal slideshow animation. Members move between them by swiping left or right and with the dots, and can still open the full list from the "See all" link. On mobile there are no Previous or Next buttons: members know to swipe. (user-originated)
- Each card shows more of the update by default, so a member understands it without opening it. (user-originated)
- Everything else about updates and the tasks page stays as it is. (user-originated)
- Mobile shows updates on its home screen; today it shows none there. (user-originated)
- On the tasks page, on web and mobile, the updates section heading reads "Project updates" and its link to the full list reads "See all". On web the activity section heading reads "Recent activity"; the mobile app has no heading above the activity feed. (user-originated)
- In the mobile app, the "Project updates" heading is grey and the same text size as the "See all" link beside it. On web the section headings are small and grey. (user-originated)
- Mobile's section headings use the app's sans-serif, not a serif. (user-originated)
- The full list of updates, where "See all" leads, is titled "Project updates" on web and mobile, and shows every update as the same card the tasks page uses. (user-originated)
- The full list of updates is reachable only from the tasks page's "See all". It has no entry in the side navigation, on web or in the mobile app, nor on the Information page or the Actions page. (user-originated)
- "See all" is green text with no background or container, styled like the project name in an activity headline, which underlines on hover. (user-originated)
- The update card keeps a white background, not grey. (user-originated)
- On web, the tasks page's "Tasks" heading is black; the "Project updates" and "Recent activity" headings stay small and grey. (user-originated)
- Admins can set an optional card image on each update in the admin update editor. A card's photos are that card image followed by the other images in the update; with neither, the project's cover image; with no image at all, a placeholder. (agent-proposed, user-approved; the photo list is user-originated)
- The update card, on web and mobile, chosen by the user from a set of design explorations:
  - The photo area is 3:2 and runs to the card's edges, with no margin. (user-originated)
  - One photo fills it. With more than one, it is a mosaic: two side by side; three or more as one large photo on the left and two stacked on the right, the last showing "+N" for photos beyond three. (user-originated)
  - The relative date sits on the photo's top-left corner and "New" on its top-right. "New" has no dot. The most recent update always shows "New", on the tasks page and the full list of updates; any other update whose notification the member hasn't read shows it too. (user-originated; the unread rule is kept from the earlier design)
  - Corners match the platform's containers: the card is rounded like the tasks page's task card (`rounded-md`), chips like the app's other chips (`rounded`). (user-originated)
  - Below the photo: the project name with its icon, the title, a short excerpt, and a footer with the profile pictures of members who participated, "N members participated", and "Read" with an arrow. (user-originated)
  - Profile pictures are the app's rounded squares, not circles. (user-originated)
  - Text uses the app's own font, Source Sans 3, at its type sizes. (user-originated)
- The update cards and the "Project updates" page follow the typography of the in-app projects list (`/actions`): Source Sans 3 throughout, and the page heading in that list's plain style (medium weight, black) instead of the serif page-title style. The public project pages' typography (`/projects/:slug`) doesn't apply to this work for now. (user-originated, choosing among agent-proposed options)
