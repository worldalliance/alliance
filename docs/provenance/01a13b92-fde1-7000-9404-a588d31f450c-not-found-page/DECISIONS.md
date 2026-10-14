# Not-found page spec

Status: implemented. [REQUIREMENTS.md](./REQUIREMENTS.md) defines the behavior and copy, with origins distinguished. The choices below are agent-authored.

## Detection

- Unmatched URLs already reach the root `ErrorBoundary` (`apps/frontend/src/ErrorBoundary.tsx`) as a route error response with status 404: from React Router when no route matches, and from `CustomLinkRedirect`'s loader when the custom-link lookup returns no data. The boundary renders the not-found page for `isRouteErrorResponse(error) && error.status === 404`. Every other error keeps its current branch, in development and production alike.
- `CustomLinkRedirect` throws whatever status the API returned. Only 404 maps to the not-found page, so a 503 or other upstream failure keeps its existing error display.
- `ProgressPostPage` and `ProgressProjectPage` loaders throw a 404 `Response` for an unknown slug instead of returning placeholder content. The root boundary then renders the page, and server rendering sends the 404 status. Their `"Post not found"` / `"Project not found"` fallbacks are removed as orphaned.
- `UserProfilePage`, `PostDetailPage`, `PostFormPage`, and `ActionPage` fetch on the client, so they cannot set an HTTP status. Their "record absent" branches render `MissingRecordPage`, which portals the not-found page into `<body>` as an opaque, full-height layer above the app chrome (`zIndex.drawer`, above the app navbar's `nav` tier). The layer sits in document flow (`absolute`, not `fixed` with its own scroll), so the window still scrolls and the site navbar's scroll styling keeps working. Load-error branches are unchanged.
- Each in-app page tells "not found" apart from "failed to load" by the response status:
  - `useUserProfileQuery` already returns `null` only for 4xx and throws on 5xx; the server answers 404 for a missing user and 400 for a non-numeric id.
  - `useForumPost` (shared with mobile) now throws on any error status but 404. Mobile's post screen therefore shows its existing "Failed to load post details" text for a 5xx instead of "Post not found".
  - `useActionHandlers` now exposes `notFound`, true only when an initial load gets a 404. Other failures keep the existing `Action not found` text, as before this change. A logged-out visitor still gets the existing members-only prompt, because the API 404s on visibility too and an anonymous request can't tell the two apart.
- The `/actions/:id` server loader is unchanged, so a missing action responds 200 when server-rendered. Its anonymous request can't tell a missing action from a members-only one.

## Component

- One `NotFoundPage` component under `apps/frontend/src/site/`, shared by the root boundary and the in-app pages. It composes `SiteRoot`, `Navbar`, a hero-style band (`DisplayHeading` on the surface background, padded by `NAV_HEIGHT`), and `SiteFooter`. Not passing `announcement` keeps the waitlist banner off.
- The band's column centers its children (`items-center text-center`). Both buttons use `SiteButton` in the primary style.
- The logged-in button uses `TASKS_HREF` with the label `My tasks`, matching the navbar's existing account label.
- The auth-dependent cluster follows the navbar's loading treatment: `opacity-0 pointer-events-none` plus `aria-hidden` while `useAuth().loading` is true.
- Tab title: root `meta` receives the boundary's error and sets `NOT_FOUND_TITLE` for a 404. Only the root's `meta` runs then, because React Router keys the error by the boundary route. `MissingRecordPage` sets `document.title` in an effect and restores it on unmount. React 19's hoisted `<title>` would sit beside the one `<Meta />` renders.
- The band grows (`flex-1` in a column `SiteRoot`) so the footer meets the viewport bottom on short content.

## Analytics

- Add `AnalyticsEvent.NotFound = "not_found"` to `common/src/analytics.ts`. `NotFoundPage` captures it on mount and on each pathname change, with properties `path` (pathname only, since the query string can carry tokens) and `source`, an enum `NotFoundSource { UnmatchedRoute, MissingRecord }`. Not forwarded to Slack. The progress loaders throw `data(NotFoundSource.MissingRecord, { status: 404 })`. The boundary reads `MissingRecord` from the error's data and treats every other 404 (router misses, unknown custom links) as `UnmatchedRoute`. `MissingRecordPage` always passes `MissingRecord`.

## Acceptance checks

1. An unknown multi-segment path and an unknown single-segment slug both render the page and respond 404 when server-rendered. No visible text contains "404".
2. `/progress/<unknown>` and `/projects/<unknown>` render the page with a 404 response. Valid slugs still render their content.
3. Unknown `/member/:id`, `/forum/post/:id`, `/forum/edit/:postId`, and `/actions/:id` render the full page with the app navbar not visible. A simulated 500 on each still shows its existing error.
4. Logged out: `Learn about the Alliance` → `/` is the only link in the body. Logged in: `My tasks` → `/tasks`, no homepage-primary button, and no avatar in the body. While auth loads, the buttons are hidden and the headline is visible.
5. A custom-link 503 and the `/error` test route keep their current rendering.
6. `not_found` fires once per view with the correct `path` and `source`.
7. Unit tests for the boundary branching and the component's auth states; then `bun run typecheck` in `apps/frontend`, `bun run dupcheck`, `bun run covercheck`, and a browser check of both auth states via the playwright skill.
