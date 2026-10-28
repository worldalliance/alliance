### action events

in a way this abstraction doesnt make sense for our current use of actions, where members just have a member action start and end, and then are done. we have a more complicated representation because we initially imagined the lifecycle of an action as potentially moving between different states, like a commitment phase, then a member action phase, then maybe going to office action and returning to member action later. so far we never do this: i could totally imagine swapping `action.events` for a simpler `action.memberActionStart` and `action.memberActionEnd` as an improvement

Similarly there is a lot of stale code for "commitmentfull" actions that have a cohort based on commitment events that will likely never be used and we want to remove

### frontend data loading

we are kind of in a bad compromise zone between basically not using any react-router-v7 framework features and using a few of them. My sense is that for most of the authenticated routes, it wouldn't really be a huge improvement to set up SSR with rr7 loaders, but it might make things nicer. if large frontend refactors are being done it would maybe make sense to either embrace framework features more fully or move to a different framework, but right now we arent deeply harmed

Relatedly, we should likely migrate to using `throwOnError: true` for the generated api (shared/lib/hey-api.ts) as this plays more nicely with the new tanstack/react-query which surfaces a thrown error but not a `response.error` which is what is returned without `throwOnError`

### Suites

Suites are basically a bad abstraction. they were made so that we could share reminders between sets of actions, but also share action timing via shared events. However if we want to assign different actions to different overlapping cohorts within the same week, sharing reminders via suites isn't really the right abstraction. Possibly the reminder system should just dynamically compute the set of actions any user is meant to be doing at any given time without reminders being created and assigned to suites at all.

### Geo

city autosuggest happens from manual loading of geonames.org data and its a bit of a mess. i didnt want to pay for some saas service that just loaded geonames data and served it to us but likely thats what everyone does and we should just do that, in the case that we ever need really robust geographic coverage for things.
