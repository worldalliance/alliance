# Decisions

1. Tests that pass `mailto:contact@worldalliance.org` to URL helpers (`common/src/url.test.ts`, `common/src/url-safety.test.ts`, `sharedweb/lib/markdownUrl.test.tsx`) stay as they are: they use the address as sample input, not as the address the site shows, and no test asserts a displayed address. (agent decision)
2. The `contact@worldalliance.org` link in `citesting/fixtures/seed_dataonly.sql` is authored content, which ALL-2145 through ALL-2147 handle, so it stays. (agent decision)
3. The privacy policy, messaging terms and child safety page each show the date of this change, 11 November 2026, as their "Last updated" date, since this change edits their text and the repo bumps that date on such edits (`ce5fa428c8` did for the privacy policy). (agent decision)
