# Decisions

All entries are agent decisions (agent judgement) unless marked otherwise. The brief for this PR came from the agent running the plan in `01a1ed2e-47fb-7000-9671-a7ba248ef2fb-admin-redesign-shell` (requirement 8 there: later phase 1 PRs are carried out by subagents). Its points are agent proposals, not owner requirements; the ones below marked "from the brief" are carried out as given. The owner could not be asked; open product choices are listed at the end.

## Search params

Found while verifying in the browser (dev build, 761 members): typing quickly into a `FilterBar` search dropped characters, and a second URL update before the first rendered undid the first. Both are fixed in PR 3's own commits and recorded in `01a1ed4a-beb8-7000-a427-43be3a7c0c5c-admin-redesign-core-pages`.

`readBuckets`/`writeBuckets` delegate to a generic `readSetParam`/`writeSetParam` (`lib/setSearchParam.ts`), now that the members page has four set-valued params.
