---
user: Alex Dorey
task: Specify a not-found page for the web frontend that matches the homepage's style
---

## User-origin requirements

- The web frontend (`apps/frontend`) has a not-found page styled to match the homepage.
- The page never uses the term "404" in any visible text.
- A logged-in user is pointed to `/tasks`. The page body does not repeat their profile image, because the site navbar already shows it.
- A logged-out visitor gets only the homepage (`/`) button in the page body; the site footer carries the other main pages.
- The headline and the button below it are centered.
- The page appears in every genuine not-found case:
  - URLs that match no route, including single-segment paths that are not a known custom link.
  - `/progress/:slug` and `/projects/:slug` when the slug matches no content.
  - In-app pages whose record does not exist: member profile (`/member/:id`), forum post (`/forum/post/:id` and `/forum/edit/:postId`), and action (`/actions/:id`). Here the not-found page replaces the whole screen, including the app's own navbar.
- Primary button copy: `My tasks` for a logged-in user (to `/tasks`); `Learn about the Alliance` for a logged-out visitor (to `/`).
- A PostHog `not_found` event is recorded each time the page is shown.

## Agent-proposed, user-approved selections

- Layout: the homepage's page root, site navbar, and site footer around a message band styled like the homepage hero.
- Headline: `We couldn’t find that page` (curly apostrophe). No subtitle.
- Browser tab title: `Page not found — The Alliance`.
- When server-rendered, `/progress/:slug` and `/projects/:slug` with an unknown slug respond with HTTP status 404. Unmatched URLs keep their existing 404 status.
- While auth state is still loading, the headline shows immediately and the auth-dependent buttons stay hidden until auth resolves, the same way the site navbar hides its account controls.
- The `not_found` event records the path and whether the page came from an unmatched route or a missing record.

## Out of scope

- Agent-proposed, user-approved: the mobile app. It gets no equivalent in this change and is a follow-up.
- Agent-proposed, user-approved: a missing activity inside an action page's side panel (`/actions/:id/activity/:activityId`) keeps its `Activity not found` panel message, since the action itself exists.
- Agent-proposed, user-approved: errors other than not-found keep their current behavior. This covers a 503 when custom links are unavailable, 500s, and network failures loading a member, post, or action.
