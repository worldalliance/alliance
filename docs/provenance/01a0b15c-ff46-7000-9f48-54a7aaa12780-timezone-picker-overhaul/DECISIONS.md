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
3. **Shared validation.** A validator in `common` that accepts any identifier
   the runtime resolves, wired into every server write path: password signup,
   OAuth signup, profile update, form extraction, admin edits.
4. **Rows from the catalog.** `shared/forms/timeZoneSelect.ts` drops the 50-row
   `TZ_OPTIONS` and builds its rows from the catalog, with the generic name and
   location as the primary label, country and offset under it, and local time at
   the trailing edge. Sorted by offset, then location. A saved or detected
   identifier the runtime resolves but neither the catalog nor its aliases
   carry gets a row of its own, labeled from `Intl` and the identifier.
5. **Search.** Match city, country, identifier, generic name, and alias, folding
   case and accents. Exact city and country matches rank first, then prefix
   matches, then other word matches.
6. **Device row pinned.** The detected timezone sits above the unfiltered list.
7. **Web combobox.** `sharedweb/forms/TimeZoneSelect.tsx` moves onto
   `@base-ui/react/combobox` with the search input inside the popup, deleting
   the hand-rolled keyboard handling, backdrop, and open state.
8. **Mobile list.** `apps/mobile/components/forms/TimeZoneSelect.tsx` swaps its
   `ScrollView` for a virtualized `FlatList` that opens on the selected row.
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
    typechecks and tests `common`, and opens a pull request on
    `tzdb/<version>`. A release that already has a pull request on that
    branch, open or closed, is skipped, so a closed one means the release was
    declined. A branch a failed run left without a pull request gets
    force-pushed over. Opening a pull request closes any other open one on a
    `tzdb/` branch, which the new release supersedes, with a comment linking
    the pull request that replaced it, and deletes its branch. A composite
    action, `open-superseding-pr`, holds the commit, push, open, and close,
    since the FormatJS bump opens its pull requests the same way. It refuses an
    empty branch prefix, which would match every branch and close every open
    pull request, and a missing token or git identity, which would otherwise
    surface after the force-push. A working tree with nothing staged ends the
    run rather than opening an empty pull request. It lists up to 1000 open
    pull requests, since the default of 30 would miss an old `tzdb/` one.

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
- The server's `Intl.DateTimeFormat` is FormatJS's, not Bun's. Bun bundles its ICU, so its tzdb only moves with a Bun release: Linux Bun 1.3.6 carries 2024a, with no `America/Coyhaique` and none of the rule changes since. FormatJS ships 2026d and published it three days after IANA. Upgrading Bun on every tzdb release would leave members' reminders wrong between Bun releases; an adapter over our own compiled rules is further off (see Out of scope).
- Bun reads `server/bunfig.toml`, and so preloads FormatJS, only when it runs from `server/`. The deploy zip carries the bunfig. `bun run repl` runs on Node through ts-node, since Bun has no `repl.start`, so it preloads the file with `-r`. `app.module.ts` throws on import when `Intl.DateTimeFormat` isn't FormatJS's, so the server, the repl, and any script that boots the app refuse to run on the runtime's own rules, and a deploy that loses the preload fails its health check.
- The swap costs speed and reach. Converting between an instant and a zone's local time runs about 2.4 to 3.7 times slower, roughly 13 to 36 µs each on a development Mac. Loading every zone adds about 53 MB of memory and 25 ms of startup to each server and `bun test` process. It also covers every `Intl.DateTimeFormat` and `Date.prototype.toLocale*String` on the server, and FormatJS's `toLocale*String` returns `"Invalid Date"` instead of throwing. Only `en` locale data loads, since the server formats only `en-US`.
- The server's local time zone is UTC. FormatJS takes UTC as the local zone whatever the host says, so the preload also sets `TZ=UTC` and `Date` agrees with it. The prod host was already on UTC with no `TZ` set (checked 2026-09-18), so crons and log timestamps there don't move. A development machine in another zone now fires crons and prints logs in UTC, as prod does. Passing the host's zone to FormatJS instead would keep development local, at the cost of development and prod disagreeing.
- FormatJS 7.8.0 reads every line of tzdb's `backward` file as a link, so its link table holds entries like `"-5:00": "EST5EDT"` and it drops the zones `backward` defines. In tzdb 2026d, `GMT` throws, in `Intl` and in Temporal. `EST5EDT`, `CST6CDT`, `MST7MDT`, and `PST8PDT` resolve to no zone, so Temporal computes them as UTC, hours off. None of the four is a catalog row or alias. `Africa/Abidjan`, `Etc/UTC`, and `Etc/GMT` have no rules either, and come out right only because they are UTC+0. The staging copy of prod taken on 2026-09-18 saves none of these names.
- `intl-timezone.ts` hardcodes no zone. It tries every catalog alias against FormatJS and gives each one that throws the rules of the catalog row it names, which today turns `GMT` into `UTC`. Bun accepted `GMT`, the catalog aliases it, and a device can report it, so refusing it would turn away a signup the server handled before. The rules go into FormatJS's public `tzData` table rather than its links, since FormatJS reads its links from a table built into the bundle. Converting stored aliases to their rows at every call site would also work, but it touches every place the server computes a local time, and this change stores an alias as sent.
- `server/src/intl-timezone.spec.ts` computes every catalog row and alias, and every zone FormatJS has rules for, at six instants from 2010 to 2023 and compares the offsets with a Bun process started from the repo root, where Bun's own ICU applies. Bun's tzdb is older but agrees about that span, since tzdb has corrected history only before 2008 since 2024a. That catches any name FormatJS throws on or has wrong rules for, without a list of known-bad names. A name Bun lacks, like `America/Coyhaique` on Linux, only has to compute. The test also checks a rule from 2025b and one from 2026d that Bun's ICU lacks, so it fails if the preload stops loading.
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
- Search matches city, country, IANA identifier, generic name, and compatibility aliases. It ignores case and accents. Exact city and country matches rank before prefix matches, followed by other word matches.
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
