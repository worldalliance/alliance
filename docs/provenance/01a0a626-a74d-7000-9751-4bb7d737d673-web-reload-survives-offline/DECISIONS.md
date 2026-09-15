# Decisions

## Catch the failed request inside `refreshUser`

The generated client's fetch rejects when a request never reaches the server, and `refreshUser` awaited `authMe()` with no guard. CommunityPage, HomePage, ActionTaskPanelForm, `MembershipPage`'s mount effect, and the group assignment handlers in `MyGroupsPage` call it without catching, so a reload that failed at any of those points threw an unhandled rejection that PostHog's exception autocapture reports. `refreshUser` now keeps the member it has, as it already did for an HTTP error. Mobile's `refreshUser` already catches this.

The group assignment handlers stay half fixed. Each awaits its own request before `refreshUser`, with no catch, so a member already offline when they click still throws from that request. Only a connection that drops between the two calls is covered now. Filed as ALL-1077.

Callers that do catch change too. `MembershipPage`'s sign and suspend handlers and the public-group join in `MyGroupsPage` wrap `refreshUser` in the same `try` as the request before it. A failed reload after a contract was signed or suspended, or a group joined, used to report that the request itself failed. Now it doesn't. `UserProfilePage`'s profile save catches the reload and logs it with `console.error`, which PostHog reported as an exception. The page shows nothing different now, and nothing reaches PostHog.

Rejected: a `try` at each call site. Every new caller would have to remember it.

## Log the failure with `console.log`

The web app starts PostHog with `capture_console_errors`, which sends every `console.error` carrying an `Error` as an unhandled `$exception`. Logging the failure there would report the same exception the catch exists to stop. `console.log` keeps it in the browser console only, matching how bootstrap logs a failed refresh in the same file.

Rejected: reporting it through `posthog.captureException` as handled. A member going offline is not a bug in the app.
