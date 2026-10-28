## The hook

`useMyLocation` in `shared/lib/` owns the location's cache: its key, the query, and `myLocationCache` for the writes that refresh it. The key carries the member's id, so a load answered for one member never stands in for the next on the same mount; signing in or out also drops it with every other query. The query resolves to `null` for a member with no stored city, since the endpoint leaves `city` out then.

`useCurrentUserLocation` keeps its signature and return shape, and reads through `useMyLocation`, so neither form renderer changes. It reports loading only while no location is cached, so a form opened again shows the cached city at once while the query refetches. A failed load falls back to the custom city text without retrying, as before: every reader has that fallback, and the settings form waits on the load, so the apps' default retries would only hold both back.

## Writes

The server sets the member's city in two places: `POST /user/update` when the body has `cityId`, and a member's `tasks/submitForm` whose answers auto-extract a city. `useUpdateProfileMutation` invalidates the location when the save carried `cityId`, and `useTaskFormSubmission` after any accepted member submission, since the client doesn't know which forms extract a city and the invalidation only refetches a location something is showing. Guest submissions and follow-up forms don't touch a member's city.

## Settings

Both settings pages read the location from `useMyLocation` instead of holding a copy in state. `useSeedSettingsForm` still loads it once per member through `myLocationCache(...).fetch`, which skips the cache and doesn't retry, as the direct call did, to seed `cityId` into the saved profile and hold the page's loading state; it shares a load the page's query already started. Because a save that sets `cityId` refreshes the query, the location placeholder and the phone-country fallback follow the member's latest saved city rather than the one the page opened with.
