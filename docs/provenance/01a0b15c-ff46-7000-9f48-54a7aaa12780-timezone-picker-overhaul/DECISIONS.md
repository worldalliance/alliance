# Decisions

## Change sequence

The overhaul ships as a run of standalone changes, ordered so that no step waits
on a later one. Each leaves web and mobile working and can merge alone. The
sections below this one carry the reasoning each step implements.

1. **Timezone catalog.** A generator downloads a pinned tzdb archive, checks its
   SHA-512, and writes `common/src/timezone-catalog.gen.ts`: the release
   version, one row per `zone.tab` identifier plus `UTC`, and the compatibility
   links out of `backward` and `etcetera`. Nothing imports it yet. Regenerating
   reproduces the committed file byte for byte.
2. **Shared validation.** A validator in `common` that accepts any identifier
   the runtime resolves, wired into every server write path: password signup,
   OAuth signup, profile update, form extraction, admin edits.
3. **Rows from the catalog.** `shared/forms/timeZoneSelect.ts` drops the 50-row
   `TZ_OPTIONS` and builds its rows from the catalog, with the generic name and
   location as the primary label, country and offset under it, and local time at
   the trailing edge. Sorted by offset, then location.
4. **Search.** Match city, country, identifier, generic name, and alias, folding
   case and accents. Exact city and country matches rank first, then prefix
   matches, then other word matches.
5. **Device row pinned.** The detected timezone sits above the unfiltered list.
6. **Web combobox.** `sharedweb/forms/TimeZoneSelect.tsx` moves onto
   `@base-ui/react/combobox` with the search input inside the popup, deleting
   the hand-rolled keyboard handling, backdrop, and open state.
7. **Mobile list.** `apps/mobile/components/forms/TimeZoneSelect.tsx` swaps its
   `ScrollView` for a virtualized `FlatList` that opens on the selected row.
8. **Mobile detection.** `expo-localization` replaces `react-native-localize`,
   and the dependency goes once `getTimeZone` has no caller.
9. **Signup capture.** Web signup, mobile signup, and the OAuth redirect send a
   validated device timezone, or `UTC` when detection fails.
10. **Backfill.** `useBackfillTimeZone` writes only a valid detected identifier
    and leaves the value missing otherwise.
11. **Settings device affordance.** Web `SettingsPage` and mobile `settings.tsx`
    show the saved value, plus `Device timezone: <label>` with a `Use` action
    when the two differ.
12. **Form default chain.** `resolveFieldDefaultValue` stops returning
    `FALLBACK_TIMEZONE`; `FormRenderer` seeds a timezone field from the
    respondent's saved timezone, then the device, then `UTC`, into form state at
    initialization. `RenderField` drops its `America/Los_Angeles` fallback.
13. **Admin defaults.** New timezone fields omit `defaultValue`, and the builder
    offers no fixed or empty default for the kind.
14. **Unavailable saved value.** A saved identifier neither the catalog nor the
    runtime knows renders raw, with a warning, and stays replaceable.
15. **Test form cleanup.** Remove the explicit `America/Los_Angeles` default
    from the local `test action form`.
16. **Release watch.** A scheduled job checks data.iana.org for a newer release
    and opens a pull request bumping the version and the checksum together.

## Catalog

- Generate the client catalog from a named IANA tzdb release. Selectable rows are every geographic identifier in `zone.tab`, plus `UTC`.
- Keep equivalent geographic identifiers separate. This preserves the location the member expects and prevents a future rule change in one country from changing members stored under another country's identifier.
- Make identifiers from IANA's compatibility links searchable and acceptable on reads. Do not list obsolete links or fixed-offset `Etc/GMT` identifiers as separate rows.
- Commit the generated TypeScript or JSON catalog. The updater downloads a pinned IANA archive, verifies its checksum, and records the tzdb version. Application builds and runtime use no network request for the catalog.
- Check for new IANA releases on a schedule and update through reviewed pull requests. A normal test run stays offline.
- Use `Intl.DateTimeFormat` for current offsets, local times, generic names, and hour-cycle preferences. The catalog supplies stable identifiers and location metadata, not transition calculations.
- A runtime that cannot format a catalog entry still lists it by location. Missing decoration does not remove a valid choice.

## Values and validation

- Store an IANA identifier string. Preserve an existing valid alias until the member selects a replacement. A new explicit selection writes the listed identifier, and detection stores the exact valid identifier reported by the platform.
- Validate timezone values on every write path, including password signup, OAuth signup, profile updates, form extraction, admin edits, and backfill.
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
