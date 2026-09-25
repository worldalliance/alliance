# Decisions

## Change sequence

The overhaul ships as a run of standalone changes, ordered so that no step waits
on a later one. Each leaves web and mobile working and can merge alone. The
sections below this one carry the reasoning each step implements.

1. **Timezone catalog.** Done. A generator downloads a pinned tzdb archive,
   checks its SHA-512, and writes `common/src/timezone-catalog.gen.ts`: the
   release version, one row per `zone.tab` identifier plus `UTC`, and the
   compatibility links out of `backward` and `etcetera`, placed with the help
   of `backzone`. Nothing imports it yet.
   Regenerating on the same runtime reproduces the committed file byte for
   byte. The country names come from `Intl.DisplayNames`, so a runtime
   carrying newer ICU data rewrites a few of them.
2. **Server timezone rules from FormatJS.** Done. `server/bunfig.toml`
   preloads `server/src/intl-timezone.ts`, which replaces Bun's
   `Intl.DateTimeFormat` with `@formatjs/intl-datetimeformat` and its full
   tzdb before any server code runs, and gives each catalog alias FormatJS
   can't resolve the rules of its row. Temporal reads zone rules through it,
   so the server's rules follow a FormatJS release instead of a Bun release.
   The deploy ships the bunfig, the repl preloads the same file, and loading
   `AppModule` without FormatJS throws.
   The release watch bumps FormatJS in the same pull request as the catalog.
   A FormatJS release that changes its tz data goes onto the open catalog
   pull request, or into a new one that supersedes any open FormatJS one,
   unless someone declined that tz data.
3. **Shared validation.** Done. `isTimeZoneIdentifier` in
   `common/src/timezone.ts` accepts an identifier the runtime resolves to
   itself, or one the catalog lists as a row or alias, except a raw offset or
   `Factory`. The server's `@IsTimeZoneIdentifier` wraps it on
   password signup, OAuth start, and `/user/update`, which had no check before.
   It rejects a value spelled in a case other than tzdb's, and
   `/user/update` treats `null` as leaving the zone unchanged. Form extraction rejects the submission
   instead of logging and skipping the value. No admin endpoint writes a
   member's timezone. An admin changing it while impersonating goes through
   `/user/update`.
4. **Rows from the catalog.** Done. `shared/forms/timeZoneSelect.ts` drops the 50-row
   `TZ_OPTIONS` and builds its rows from the catalog, with the generic name and
   location as the primary label, country and offset under it, and local time at
   the trailing edge. Sorted by offset, then location. A saved or detected
   identifier the runtime resolves but neither the catalog nor its aliases
   carry gets a row of its own, labeled from `Intl` and the identifier.
   A row reads `Pacific Time · Los Angeles` over `United States · UTC-8`,
   the offset in whole hours plus `:mm` where it has minutes. A runtime with
   no generic name leaves the city alone, and one with no offset leaves the
   country alone. Many rows share a generic name, country, and offset, such
   as the twelve `Argentina Standard Time` rows, so where the first line runs
   out of room the web cuts the generic name and keeps the city whole, and
   mobile cuts the middle. The uncatalogued row reads
   `<generic> · <identifier>`, its location the raw identifier, since a
   device's `Etc/GMT+8` names an offset with the opposite sign and has no
   city. It lasts while the value holds that identifier. A saved alias shows
   its catalog row as selected and stays the stored value until the member
   picks a row. The curated labels and
   extra search terms go with `TZ_OPTIONS`. Aliases bring back most of what
   they found, such as `arizona` through `US/Arizona`, and step 5 covers
   the rest. The generic name still comes from
   `en-US`, as before this step, since search and the second line are English.
   A closed picker labels only its selected zone and builds the list the first
   time it opens, since every picker on a screen otherwise labels all ~420
   zones at mount, about 5 times the work of the 51 curated rows. The list
   stays once built, since the mobile modal shows it through its fade-out,
   and refreshes its clocks only while open, since otherwise every picker
   opened once relabels all ~420 zones each minute.
   Building every zone's formatters on open took 1.9 to 2.2 s in an Android
   release build on the emulator and about 135 ms in a debug build on the iOS
   simulator, so a mounted picker builds them in `requestIdleCallback` a zone
   at a time. The warm-up is shared by every picker. An open before it ends
   shows a spinner until it does rather than labelling the rest at once,
   which froze a Moto G Play (2024) for about 5.8 s. In a browser a step
   runs within 100 ms even while the runtime never idles, labelling zones for
   8 ms, so a busy app still fills the list, in a few steps rather than a
   zone each 100 ms. React Native schedules a step without that timeout, but
   flags it `didTimeout` once it starts over 100 ms late and still gives it
   up to 50 ms, which it takes back for urgent work, so only a step starting
   with no time remaining is forced, and any other stops on `timeRemaining`
   alone.
   A runtime without `requestIdleCallback` builds on open, as the tests and
   Safari do.
   Measured on that phone in a production bundle, Hermes spends most of the
   build constructing formatters: about 5 ms each for an explicit `en-US`
   locale against under 2 ms for its default one, so formatters that need
   English take the default locale where it resolves to exactly `en-US`.
   `formatToParts` costs about twenty times what `format` does, so an offset
   formatter whose resolved locale is `en-US` and whose string once read the
   same wall clock as its parts reads its string from then on. The clocks
   come from each row's offset through one UTC formatter rather than a
   formatter per zone, and the sort compares cities with one `Intl.Collator`,
   since `localeCompare` cost 110 ms a sort. Together these took the whole
   build from 5.8 s to 2.6 s and each minute's refresh of an open list from
   470 ms to 43 ms, against 50 ms for the 51 curated rows. Warming produced
   no JS stall over 66 ms, and an open after it stalls as long as the curated
   list's did, about 350 ms, most of it laying out the `FlatList`.
5. **Search.** Done. Match city, country, identifier, generic name, and alias,
   folding case and accents. Exact city and country matches rank first, then
   prefix matches, then other word matches.
   A row's search text carries every alias the catalog maps to it, so
   `calcutta` finds Kolkata, and its city and country with `&` spelled `and`,
   a straight apostrophe, and `St` spelled `Saint`, since CLDR writes
   `Trinidad & Tobago`, `Côte d’Ivoire`, and `St. Lucia`, and tzdb
   `St Johns`. A place is also searchable with its periods, apostrophes, and
   parentheses dropped and each hyphen and the spaces around it as one
   space, so `us virgin islands`, `guinea bissau`, `cote divoire`,
   `myanmar burma`, and `congo brazzaville`, which CLDR writes
   `Congo - Brazzaville`, find their zones.
   `timeZoneCuratedNames.ts` also carries the English names people type
   where CLDR writes another, so `uae`, `ivory coast`, `czech republic`,
   `east timor`, `palestine`, `swaziland`, `holland`, `drc`, and `dr congo`
   find their zones rather than nothing, and London carries
   `Great Britain`. The Congos carry their names with and without `the`,
   since a query matches as one run from a word's start. Brazzaville
   carries `Republic of the Congo`, since that query otherwise finds only
   the DRC zones, whose name it sits inside. They match as place names
   rather than curated names, so partial typing ranks them like any other
   place: as curated names they opened `ho` on Amsterdam and `sw` on
   Mbabane. Search also matches the offset on the second
   line, so `utc+5:30` and `+5:45` find the zones at that offset. Only a
   query reading as an offset, such as `gmt+01:00`, `-3`, or `utc 5`,
   reaches the offsets, rewritten to the form the row writes, so `u` keeps
   no row by its offset, and `utc+5:` and `+5:` open on the same row. A query
   with no letters matches no place, since `-` would otherwise open on the Congo zones
   CLDR writes `Congo - Kinshasa`. What the query matches by name lists
   first, so `gmt+0`, which aliases name UTC, opens on UTC ahead of the other
   zones at UTC+0 rather than on Abidjan. Among the offsets, a row at exactly
   the typed one lists first, so `utc-1` opens on UTC-1 rather than on
   UTC-11, which sorts ahead of it, and UTC lists first among the rows at
   its offset, so `utc+0` and `+0` open on UTC rather than on Abidjan, which
   sorts ahead of it by city. Packed digits take two of
   hour where those are 14 or less, so `+053` is partway to UTC+5:30 rather
   than UTC+0:53 and the list stays filled while `+0530` goes in, and
   `+530` still reads as UTC+5:30. Two hour digits or a colon end the hour,
   so `utc+01` and `utc+1:` keep UTC+1 alone rather than UTC+10 through
   UTC+14 with it, and two minute digits, or a `0`, which starts no zone's
   minutes, end the offset. A pasted `−` (U+2212), as Wikipedia writes
   offsets, reads as `-`.
   An offset followed by `time` finds what
   it finds alone. "Prefix" means a city or country the query
   starts, so `india` puts Kolkata ahead of the Indiana zones, which only an
   identifier word matches. Each rank keeps the offset order.
   `shared/forms/timeZoneCuratedNames.ts` gives London and Perth the places
   that no city, country, or alias spells, such as `uk`, `britain`, and
   `western australia`, and they rank as place names, so `uk` puts London
   ahead of Ukraine. The same file names the zone most of a multi-zone
   country keeps after the country, such as São Paulo for `brazil`, plus
   `china` and `hawaii`, and a query naming one of its names in full ranks
   that zone above every other place it names in full, since offset order
   alone opened `china` on Urumqi, `brazil` on Eirunepe, and `hawaii` in
   winter on Adak. It names `US`, `USA`, `America`, and `Korea` the same way, and the
   four US time names (`Eastern Time` → New York, `Central Time` → Chicago,
   `Mountain Time` → Denver, `Pacific Time` → Los Angeles), and a query
   starting one of its names ranks that zone after the full-name matches but
   ahead of the places the query only starts. Without that, `eastern` opened
   on Atikokan, which keeps no DST, `central` on Bangui through the Central
   African Republic, `us` on Ushuaia, `united` on Adak, and `america` on
   Pago Pago through American Samoa.
   `Central Africa Time` goes to Maputo, since `central africa` also opened
   on Bangui, which keeps West Africa Time. London carries
   `Greenwich` and `GMT`, so `greenwich` and `gmt` open on London, ahead of
   UTC and the zones Intl calls Greenwich Mean Time, which stay on UTC through
   the British summer.
   The curated time names the catalog's own names would open elsewhere go the
   same way: `Central European Time` → Paris, `Eastern European Time` →
   Athens, `Atlantic Time` → Halifax, `Brasilia Time` → São Paulo, and
   `Central Australia` → Darwin, since in summer `central european` opened
   on Algiers, `eastern european` on Kaliningrad, and `atlantic` on
   Anguilla, each keeping no DST. A query finding nothing retries without a
   trailing `time`, or as much of it as is typed, so `hawaii time` and
   `moscow time`, which the curated labels spelled, find their zones at
   every keystroke.
   Steps 4 and 5 land as one change: without ranking and those place names,
   the catalog's rows open `india` on Indiana and `uk` on Ukraine, and Enter
   picks the first row.
6. **Device row pinned.** Done. `useTimeZoneSelect` takes the detected
   `deviceTimeZone` and, with no query, lists its row first and the rest in
   offset order without it, so no zone appears twice and a device zone that
   is also the saved one opens the list at the top. A search ranks it like
   any other row. The web reads it through `deviceTimeZone()` in
   `shared/lib/timeZone.ts` once per mount, and mobile through
   `getDeviceTimeZone()`, which step 9 moves to `expo-localization`. An
   alias pins the row it names. A valid zone the catalog lacks gets a row of
   its own, as a saved one does, and one the runtime can't resolve pins
   nothing. Wherever the row appears, a device icon named
   `Device time zone` marks it, since otherwise nothing explains a row
   sitting out of offset order.
7. **Web combobox.** Done. `sharedweb/forms/TimeZoneSelect.tsx` moves onto
   `@base-ui/react/combobox` with the search input inside the popup, deleting
   the hand-rolled keyboard handling, scrolling, and backdrop, and with it
   `zIndex.popoverBackdrop`, which only that backdrop used. Open state and
   the query stay in `useTimeZoneSelect`, which mobile shares, and Base UI
   takes the hook's rows as `filteredItems`. The hook's `activeIndex` goes,
   since Base UI owns the highlight and mobile never read it.
   Opening highlights the selected row and scrolls it into view, and a search
   highlights the first match. Base UI finds the selected row only while
   closed, and the hook builds the rows on the first open, so the popup opens
   one commit after they arrive. An open before the warm-up ends shows the
   spinner in the trigger's chevron slot and opens the popup once the rows
   exist, since a popup opened on the spinner would get its rows with none
   highlighted and the list scrolled to the top. Base UI counts itself closed
   until then, so the trigger itself cancels the waiting open on Escape, a
   second press, or losing focus.
   Base UI highlights the row under any `mousemove`, and WebKit fires one
   when the list scrolls under a still pointer, so the arrow keys' row would
   jump to the pointer's and Enter would pick it. A row skips Base UI's
   handler unless the pointer moved since the page last saw it.
   The trigger's role is now `combobox`, which takes no name from its
   content, so it is labelled by its value, after the question where the
   caller passes one; the Settings page passes none. Typing on the closed trigger does
   not start a search, as it does in `SearchableSelect`, since nothing asked
   for it here.
8. **Mobile list.** Done. `apps/mobile/components/forms/TimeZoneSelect.tsx`
   swaps its `ScrollView` for a virtualized `FlatList` that opens on the
   selected row. Each row holds one line of name and one under it, cut short
   with an ellipsis, so every row is the height of any one laid out, whatever
   the member's font scale. The name is cut mid-way rather than at its end,
   since the city ends it and is what tells apart the zones sharing a generic
   name. The closed picker cuts its name the same way, so a long one keeps
   its city. The list measures every row it lays out, so a font scale changed
   while the picker stays mounted updates the height, and passes
   `getItemLayout`, so it scrolls straight to the selected row by index.
   Rendering every row up to the selected one instead, as it did before, means
   around 400 rows at once over the catalog's rows for a member east of
   Europe. The scroll waits for that measurement, since without
   `getItemLayout` `scrollToIndex` throws on an unmeasured row, runs once per
   open, and is dropped once the member types. Those rules live in
   `selectedRowScroller.ts` so they can be tested without a renderer.
   `FormModal` takes `scrollable={false}` so the list is not nested in its
   `ScrollView`.
9. **Mobile detection.** `expo-localization` replaces `react-native-localize`,
   and the dependency goes once `getTimeZone` has no caller.
10. **Signup capture.** Web signup, mobile signup, and the OAuth redirect send a
    validated device timezone, or `UTC` when detection fails.
11. **Backfill.** `useBackfillTimeZone` writes only a valid detected identifier
    and leaves the value missing otherwise.
12. **Settings device affordance.** Web `SettingsPage` and mobile `settings.tsx`
    show the saved value, plus `Device timezone: <label>` with a `Use` action
    when the two differ.
13. **Form default chain.** `resolveFieldDefaultValue` stops returning
    `FALLBACK_TIMEZONE`; `FormRenderer` seeds a timezone field from the
    respondent's saved timezone, then the device, then `UTC`, into form state at
    initialization. `RenderField` drops its `America/Los_Angeles` fallback.
14. **Admin defaults.** New timezone fields omit `defaultValue`, and the builder
    offers no fixed or empty default for the kind.
15. **Unavailable saved value.** A saved identifier neither the catalog nor the
    runtime knows renders raw, with a warning, and stays replaceable.
16. **Test form cleanup.** Remove the explicit `America/Los_Angeles` default
    from the local `test action form`.
17. **Release watch.** Done. `tzdb-release-watch.yaml` runs weekly.
    `common/scripts/bump-tzdb.ts` checks `tzdata-latest.tar.gz` against its
    PGP signature, reads its version, and, when it is newer, rewrites the
    generator's version and checksum. An older one, from a cached copy behind
    a pin moved by hand, fails the run. The job regenerates the catalog,
    bumps FormatJS under the rule below, typechecks and tests `common`,
    typechecks the server and runs its timezone test, and opens a pull
    request on `tzdb/<version>`. A release that already has a pull request on that
    branch, open or closed, is skipped, so a closed one means the release was
    declined. One from a fork doesn't count: the repository is public and
    release names are easy to guess, so anyone could otherwise block a
    release. A release that adds a zone the server's FormatJS lacks fails
    the timezone test until FormatJS ships the zone, so a later run opens its
    pull request. Runs don't overlap, or an older one's close step could take a
    newer one's pull request with it and the skip rule would retire that
    release. A branch a failed run left without a pull request gets
    force-pushed over. Opening a pull request closes any other open one
    github-actions opened on a `tzdb/` or `formatjs/` branch, which the new
    release supersedes, labels it
    `superseded`, comments with a link to the pull request that replaced it,
    and deletes its branch. One it labels but fails to close loses the label
    again unless GitHub reports it closed, so a later close by hand reads as
    declined. Someone's own branch that shares a prefix, such as
    `formatjs/upgrade-v7`, stays open: the action closes only pull requests by
    the new one's author, so the token a caller passes decides whose it closes.
    A composite action, `open-superseding-pr`, holds
    the commit, push, open, and close, since the FormatJS bump opens its pull
    requests the same way. It takes a list of branch prefixes and refuses an
    empty one, which would match every branch and close every open pull
    request, and a missing token or git identity, which would otherwise
    surface after the force-push. A working tree with nothing staged ends the
    run rather than opening an empty pull request. It lists up to 1000 open
    pull requests, since the default of 30 would miss an old `tzdb/` one.
    When the run opens no pull request, a second job bumps FormatJS on the
    open `tzdb/` branch github-actions opened if there is one, else `main`, and typechecks the
    server and runs its timezone test.
    On a `tzdb/` branch it runs `.github` as of the run's revision, not the
    branch's, so a script's outputs match what the workflow reads, and it
    commits only `server/package.json` and `bun.lock`. The jq filters that
    decide what counts as declined, carried, or superseded live in `.jq`
    files, tested by `.github/scripts/jq-filters.test.ts`; `.github` joins
    the unit test packages for it, but not the typecheck ones, since it has
    no tsconfig. Scripts pipe `gh`'s JSON into `jq` rather than passing a
    filter to `gh --jq`, whose built-in gojq is not the engine the test runs.
    `.github/scripts/bump-formatjs.sh` does the bump for both jobs: it
    updates `@formatjs/intl-datetimeformat` within its major version and
    keeps the update only when it changes `add-all-tz.js`, since most
    FormatJS releases carry the same tz data as the one before, and
    `formatjs/<hash>` has no merged or closed pull request outside a fork,
    where `<hash>` is the first 12 hex digits of `add-all-tz.js`'s SHA-1.
    The repository is public, so anyone can open a fork's pull request on
    that branch name, and the hash is computable from the npm release.
    A same-repository one still counts, since opening its own pull request
    there would force-push over that branch. A merged one
    already landed that tz data, and a closed one means someone declined
    it, except one labeled `superseded`: its bump comes back when the pull
    request that closed it doesn't merge.
    Skipping it in the catalog job too keeps a declined bump from coming
    back inside the next catalog pull request. On the `tzdb/` branch it pushes the bump and comments
    on the pull request, since a second pull request would change the same
    `bun.lock` and `server/package.json` lines and conflict with it after
    either merged. A FormatJS bump on a `tzdb/` branch, the catalog job's or
    a pushed one, is its own commit, so reverting it declines it the same way
    in either job. Its message names the tz data hash, as the catalog pull
    request's body does when it bumps FormatJS. The hash leads the headline,
    since GitHub cuts headlines off at 69 characters and a revert's adds
    `Revert "` in front. A revert of that revert, which git titles
    `Reapply "…"`, takes the decline back: an odd number of nested reverts
    leaves the tz data declined. Rewording the commit or squashing it into
    another on the branch declines it too, so the body and the push's
    comment warn against both. Squash-merging doesn't: the merged checkout
    carries the tz data. The job
    skips tz data the pull request already carried: gone from the branch,
    someone removed it to decline it. The script
    also drops tz data a commit on any `tzdb/` pull request github-actions
    opened reverts, by a `Revert "…"` headline naming the hash, tz data
    its body proposes or the watch's comment on a push to one names but no
    headline there carries, since both name the hash and a force-push can
    drop the commit, whichever job made it, and tz data
    a merged `tzdb/` one named in its body or a headline but the checkout
    lacks, since a reviewer can remove it by hand too, so the decline
    outlives that pull request instead of the bump returning in the next
    catalog pull request, or as a `formatjs/` one after it merges. On `main` it opens a pull request on `formatjs/<hash>`,
    unless one outside a fork is already open there. A branch named for the version would let a declined bump
    come back, and replace an open one, at the next FormatJS release, which
    usually carries the same tz data. The new pull request closes any other
    open `formatjs/` one and labels it `superseded`. Pushing new tz data onto
    an open `formatjs/` branch instead would leave its name behind the data
    it carries. When it drops declined tz data, the script names the
    declining pull requests in a job notice and, in the catalog job, the
    pull request's body, since a merged pull request that lost its bump by
    accident, say while resolving a `bun.lock` conflict, would otherwise keep
    that tz data out without anyone seeing why. A separate job fails when npm
    has a newer FormatJS major than `server/package.json` allows, so it runs
    whether or not a catalog pull request opened.

## Catalog

- Generate the client catalog from a named IANA tzdb release. Selectable rows are every geographic identifier in `zone.tab`, plus `UTC`.
- Keep equivalent geographic identifiers separate. This preserves the location the member expects and prevents a future rule change in one country from changing members stored under another country's identifier.
- An alias points at the row in the place its name names, not merely one with the same clocks since 1970. The generator takes the row a `#=` comment in `backward` names, then the row `backzone` links the name to, and only then the link's own target. Without that, `Iceland` lands on `Africa/Abidjan` and `Pacific/Yap` on Papua New Guinea. Reading `backzone` instead of keeping a hand list also places a link of this kind that a later release adds, as long as `backzone` records it.
- Make identifiers from IANA's compatibility links searchable and acceptable on reads. Do not list obsolete links or fixed-offset `Etc/GMT` identifiers as separate rows. The member's own saved or detected value is the exception: an identifier the runtime resolves but the catalog lacks still gets a row. Devices can report fixed offsets, and a zone newer than the pinned release has no row until the bump lands.
- Commit the generated TypeScript or JSON catalog. The updater downloads a pinned IANA archive, verifies its checksum, and records the tzdb version. Application builds and runtime use no network request for the catalog.
- Check for new IANA releases on a schedule and update through reviewed pull requests. A normal test run stays offline. The reviewer reads the catalog diff, which is what a release changes for members; the checksum the job writes is only as good as the download it hashes, so the job first checks that download against IANA's PGP signature. The signing key is Paul Eggert's, fingerprint `7E37 92A9 D8AC F7D6 33BC 1588 ED97 E90E 62AA 7E34`, committed as a keyring from keys.openpgp.org. `gpgv` ignores key expiry, so only a new signing key fails the run, until someone commits it. A pull request opened with `GITHUB_TOKEN` starts no workflows, so the job runs `common`'s typecheck and tests itself and the pull request asks for a close and reopen to start CI.
- Use `Intl.DateTimeFormat` for current offsets, local times, generic names, and hour-cycle preferences. The catalog supplies stable identifiers and location metadata, not transition calculations.
- A client runtime that cannot format a catalog entry still lists it by location. Missing decoration does not remove a valid choice.

## Values and validation

- Store an IANA identifier string. Preserve an existing valid alias until the member selects a replacement. A new explicit selection writes the listed identifier, and detection stores the exact valid identifier reported by the platform.
- Validate timezone values on every write path, including password signup, OAuth signup, profile updates, form extraction, admin edits, and backfill.
- A raw offset such as `-08:00` is not a valid new value, though `Intl` resolves it. It names no place, the catalog has no row for it, and every other stored value is an identifier. `Etc/GMT+8` stays valid, since devices report it. `Factory`, tzdb's placeholder zone, is refused for the same reason: Bun resolves it, but it names no place.
- Validation rejects a value whose case differs from tzdb's spelling, such as `america/los_angeles`, rather than fixing it. Stored as sent, it misses exact-match lookups like `getCountryForTimezone`. A value passes when the runtime resolves it to the same spelling, or when the catalog lists it as a row or alias. FormatJS on the server and V8 in the browser swap an alias for its canonical zone, so there the catalog is what keeps `US/Pacific` valid. Bun keeps an alias as sent and fixes only its case, so there the first test alone accepts any name its tzdb knows. The answer still follows each runtime's tzdb: Bun accepts `EST5EDT`, which V8 and the server refuse.
- The server's runtime decides whether a timezone is valid, not the catalog, because reminders run on it. `@js-temporal/polyfill` reads zone rules from `Intl.DateTimeFormat`, so a zone the server's `Intl` lacks throws wherever the server computes local time. The catalog decides what the picker offers. A zone newer than the catalog passes if the runtime knows it.
- The server's `Intl.DateTimeFormat` is FormatJS's, not Bun's. Bun bundles its ICU, so its tzdb only moves with a Bun release: Linux Bun 1.3.6 carries 2024a, with no `America/Coyhaique` and none of the rule changes since. FormatJS ships 2026d and published it three days after IANA. Upgrading Bun on every tzdb release would leave members' reminders wrong between Bun releases; an adapter over our own compiled rules is further off (see Out of scope).
- Bun reads `server/bunfig.toml`, and so preloads FormatJS, only when it runs from `server/`. The deploy zip carries the bunfig. `bun run repl` runs on Node through ts-node, since Bun has no `repl.start`, so it preloads the file with `-r`. `app.module.ts` throws on import when `Intl.DateTimeFormat` isn't FormatJS's, so the server, the repl, and any script that boots the app refuse to run on the runtime's own rules, and a deploy that loses the preload fails its health check.
- The release watch bumps FormatJS within its major version. A major can move the files `intl-timezone.ts` imports, so it waits for someone to take it by hand, and the watch fails until they do: once FormatJS stops releasing the old major, the server's tz data would stop updating with nothing to show for it. FormatJS ships each tzdb release a few days after IANA, usually after the catalog's pull request has opened, so the watch also bumps FormatJS when only FormatJS has new tz data.
- The swap costs speed and reach. Converting between an instant and a zone's local time runs about 2.4 to 3.7 times slower, roughly 13 to 36 µs each on a development Mac. Loading every zone adds about 53 MB of memory and 25 ms of startup to each server and `bun test` process. It also covers every `Intl.DateTimeFormat` and `Date.prototype.toLocale*String` on the server, and FormatJS's `toLocale*String` returns `"Invalid Date"` instead of throwing. Only `en` locale data loads, since the server formats only `en-US`.
- The server's local time zone is UTC. FormatJS takes UTC as the local zone whatever the host says, so the preload also sets `TZ=UTC` and `Date` agrees with it. The prod host was already on UTC with no `TZ` set (checked 2026-09-18), so crons and log timestamps there don't move. A development machine in another zone now fires crons and prints logs in UTC, as prod does. Passing the host's zone to FormatJS instead would keep development local, at the cost of development and prod disagreeing.
- FormatJS 7.8.0 reads every line of tzdb's `backward` file as a link, so its link table holds entries like `"-5:00": "EST5EDT"` and it drops the zones `backward` defines. In tzdb 2026d, `GMT` throws, in `Intl` and in Temporal. `EST5EDT`, `CST6CDT`, `MST7MDT`, and `PST8PDT` resolve to no zone, so Temporal computes them as UTC, hours off. None of the four is a catalog row or alias. `Africa/Abidjan`, `Etc/UTC`, and `Etc/GMT` have no rules either, and come out right only because they are UTC+0. The staging copy of prod taken on 2026-09-18 saves none of these names.
- `intl-timezone.ts` hardcodes no zone. It tries every catalog alias against FormatJS and gives each one that throws the rules of the catalog row it names, which today turns `GMT` into `UTC`. Bun accepted `GMT`, the catalog aliases it, and a device can report it, so refusing it would turn away a signup the server handled before. The rules go into FormatJS's public `tzData` table rather than its links, since FormatJS reads its links from a table built into the bundle. Converting stored aliases to their rows at every call site would also work, but it touches every place the server computes a local time, and this change stores an alias as sent.
- `server/src/intl-timezone.spec.ts` computes every catalog row and alias, and every zone FormatJS has rules for, at six instants from 2010 to 2023 and compares the offsets with a Bun process started from the repo root, where Bun's own ICU applies. Bun's tzdb is older but agrees about that span, since tzdb has corrected history only before 2008 since 2024a. That catches any name FormatJS throws on or has wrong rules for, without a list of known-bad names. A name Bun lacks, like `America/Coyhaique` on Linux, only has to compute. The test also checks a rule from 2025b and one from 2026d that Bun's ICU lacks, so it fails if the preload stops loading.
- The server refuses the four System V names, which resolve to no zone the catalog lists, so no member saves one from here on. `GMT` and the three UTC+0 names pass and compute right. No test lists them: every name the server accepts is a catalog row, a catalog alias, or a zone FormatJS has rules for, and `server/src/intl-timezone.spec.ts` checks all of those against Bun's tzdb.
- A member cannot clear a saved timezone. `/user/update` keeps the saved value when the field is `null` or left out. Mobile builds from before 2026-07-29 send the whole `/auth/me` user on every settings save, `timeZone: null` included for a member with no zone, and a 400 there would fail the whole save.
- An invalid timezone in an auto-extracting form field fails the whole submission with a 400. The check runs before the phone number's opt-in MMS goes out, so a rejected submission has no side effects.
- Invalid new values produce a validation error. An invalid saved value renders as its raw identifier with an unavailable warning and remains replaceable; it does not silently become UTC.
- Historical form answers remain byte-for-byte unchanged. Rendering continues to tolerate old raw offsets such as `-08:00`.

## Detection and defaults

- Web detection uses `Intl.DateTimeFormat().resolvedOptions().timeZone`.
- Mobile detection uses `expo-localization`. Remove `react-native-localize` once no caller remains.
- Password and OAuth signup capture the device timezone without another signup control. If valid detection is unavailable, signup sends `UTC` because signup requires a value.
- Backfill writes only a valid detected timezone. A failed detection leaves the value missing for a later retry. Backfill remains disabled during admin impersonation.
- Settings always show the saved value. When the device differs, show `Device timezone: <label>` with a `Use` action. Only that action changes the editable value.
- A timezone form field has one default chain: the signed-in respondent's saved timezone, then a valid device timezone, then `UTC`. Signed-out respondents start at device timezone, then `UTC`.
- The chosen form default enters form state during initialization. Required fields therefore submit when the respondent accepts the default without opening the picker.
- Admins do not configure fixed or empty defaults for timezone fields. New timezone fields omit `defaultValue`. Remove the explicit `America/Los_Angeles` default from the retained `test action form`.
- Existing account values receive no migration. Device changes never overwrite a saved preference.

## Presentation and search

- A row's primary label combines the generic timezone name and location, for example `Pacific Time · Los Angeles`.
- Its secondary line shows country and current UTC offset. Show current local time at the trailing edge.
- Omit abbreviations such as `CST`, which identify several unrelated zones.
- Pin the detected device timezone above the unfiltered list. Sort the remaining rows by current UTC offset, then location name.
- Search matches city, country, IANA identifier, generic name, compatibility aliases, and the offset shown under the name. It ignores case and accents. Exact city and country matches rank before prefix matches, followed by other word matches.
- Use the runtime locale for clock, offset, and names available through `Intl`. Generated city and country fallbacks remain English. Translated fallback dictionaries are outside this change.
- Use the runtime's 12-hour or 24-hour preference rather than a global default.

## Platform controls

- Web uses `@base-ui/react/combobox` with the search input inside its popup. Base UI owns focus, keyboard navigation, selection semantics, escape handling, and screen-reader roles.
- Mobile uses the existing form modal pattern with a searchable `FlatList`. It opens with the selected row in view and keeps the list virtualized.
- Do not adopt `react-timezone-select`, `timezone-select-js`, a native date-time picker, Moment Timezone, or `@vvo/tzdb` as the picker. They either cover one platform, group geographic identifiers, ship data or date machinery this feature does not need, or cannot guarantee the chosen catalog policy.

## Data cleanup

- Keep `test action` and its attached `test action form`; they are used for occasional testing.
- Remove that form's explicit Los Angeles default so it exercises respondent-timezone initialization.
- Do not rewrite existing responses from this or any other form.

## Out of scope

- IP and GPS detection.
- Full translation of generated search metadata.
- Silent updates when the member travels or changes device settings.
- Bulk canonicalization of valid stored aliases.
- Resolving zones through an adapter over rules compiled from the pinned tzdb archive. It would make the verified archive the server's only source, at the cost of rewriting every place that computes a local time, with a less maintained compiler. Worth revisiting if FormatJS's speed or upkeep becomes a problem.
