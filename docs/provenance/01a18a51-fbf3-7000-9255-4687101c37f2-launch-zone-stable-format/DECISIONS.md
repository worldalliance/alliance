# Decisions

- `inLaunchZone` formats with a fixed date-fns pattern on a `TZDate` instead of `toLocaleString` with `dateStyle`/`timeStyle`. The joiner `Intl` puts between the date and the time comes from the runtime's ICU data: Bun on macOS gives `Nov 3, 2026 at 7:00 PM`, Bun on the Linux runners gives `Nov 3, 2026, 7:00 PM`. A fixed pattern removes that dependence, and the page already depends on `@date-fns/tz`.
