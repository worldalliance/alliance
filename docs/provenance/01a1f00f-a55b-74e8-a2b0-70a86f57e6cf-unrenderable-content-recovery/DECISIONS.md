# Decisions

All agent decisions unless labelled otherwise.

## Mobile recovery

- `restartIntoUpdate` saves the current route, query parameters included (expo-router's `useUnstableGlobalHref`, so `/messages/new?to=…` keeps its recipient), before `reloadAsync`; `ResumeAfterRestart` opens it with `router.navigate` (a push would stack a second home screen on a restart from home) once auth has loaded, waiting through a session restore that failed and may succeed on retry, for signed-in members only, if it was saved under two minutes ago and is an in-app path. The banner's restart returns to the same screen too. In-memory state (an open task flow) isn't restored: the member lands on the screen, not inside a sheet opened on it. expo-router marks that hook private and may add a hostname to it; `takeResumeRoute` then rejects the route as not in-app, so the restart lands on the home screen rather than anywhere unexpected. A failed save, read or drop of the route, and a saved entry that is unreadable or not an in-app path, is reported as `resume_route_failed` (not sent to Slack: the member still lands on the home screen). A failed reload drops the saved route, so a later launch from a push or link isn't sent back to it.
