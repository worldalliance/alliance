## Diagnosis

Frames pulled out of the recording at 4–10fps (ffmpeg, into `.scratch/`) show a reload loop, not a slow page:

- The URL bar reads `worldalliance.org` in every sampled frame. The browser never commits `thealliance.org`.
- The stop/reload button alternates and the progress bar restarts from zero roughly every 900ms.
- Each cycle goes blank → navbar without avatar → navbar with the member's avatar → blank. Every load reaches the point where `authMe` resolves, then reloads.

`DomainMigrationModal`'s effect is the only code in the app that starts a document navigation when `user` lands, which matches the timing exactly. The other three `location.href` writes were ruled out: logout goes to `/login`, which sits outside `applayout` and so would drop the navbar and avatar entirely, and the two in `ActionTaskPanelForm` only fire on form submit.

Confirmed the deployed bundle runs the same code, by pulling `applayout-vFMWRzWo.js` off production and checking the minified domain constants against the `url-*.js` export map. They are not swapped.

**Not established: why the hop failed to leave the origin.** As of Sept 14 all four hosts (`{www.,}{world,the}alliance.org`) return 200 from the same nginx on one IP with byte-identical HTML and no redirect either way, and driving a browser through `location.href = "https://thealliance.org/actions"` from worldalliance.org lands on `thealliance.org/login` and stays. Either the new domain was bouncing back on Sept 8, which an HTTP redirect would explain since the URL bar never commits an intermediate hop, or the session on the old domain was being re-established each cycle. Recorded as unresolved.

The fixes were proposed and built around the defect that holds regardless: the redirect had no loop guard, so any condition that returns the browser to the legacy origin turns a one-time hop into an unbreakable loop with no UI to escape from.

## Implementation choices

- `sessionStorage` for the attempt marker, because it is scoped per-origin and per-tab, which is the scope the guard needs. The marker lives on the legacy origin and survives the tab moving to the new one and back.
- The second prompt is a new state on the existing modal rather than a separate component, branched with an enum and an exhaustive `switch` per the enum-branching rule in AGENTS.md.
- The escape from the second prompt is a plain `<a href>`, so the reader decides when to leave and a second failed hop cannot restart the cycle. Deliberately not `useSiteHref`: `siteHref` reduces a link to either alliance domain down to a bare path, which is the exact trap this modal is trying to get the reader out of.
- `redirectToNewDomain` throws on a target computed onto the origin already loaded rather than returning a `Result`. It can only fire if the two domain constants collapse to one host, which is a build-time mistake, not a runtime member state, so failing loudly beats a silent reload. This mirrors what `deploy/nginx/alliance.conf` already does with `__DOMAIN__` and `__ALT_DOMAIN__`.
- The server block covers `mode: "cookie"` only. `apps/mobile/lib/config.ts` points production at `https://worldalliance.org/api` and the app logs in with `mode: "header"`, so a blanket host check would have locked every migrated member out of iOS. Bearer sessions have no domain to cross.
- Blocked on the member `POST /auth/login` endpoint only. `auth/admin/login` runs on `admin.<domain>`, has no migration modal mounted, and is not part of this loop.
- 409 rather than 401, since the `hey-api` wrapper in `shared/lib/hey-api.ts` treats 401 as a signal to refresh and retry.
- `ACCOUNT_MOVED_MESSAGE` lives in `common/src/url.ts` so both ends import one string. Matching an error on its message follows the pattern already in `ActionTaskPanelForm` ("Form already submitted"); the constant removes the duplicated literal that pattern usually carries.
- `isLegacyAllianceHost` also went into `common/`, since the server needs the same match and `sharedweb` is not importable there. It strips a port, which a `Host` header carries in local runs. `sharedweb`'s `isLegacyDomain` became a re-export of it rather than a second one-line copy.
- Left the modal's `thealliance.org` copy as literals instead of templating it from `ALLIANCE_DOMAIN`. An earlier pass did template it; reverted, because that change traces to nothing the user asked for.

## Left alone

- `bun run gen-api` was not run, so `AuthLoginErrors` in `shared/client/types.gen.ts` still lists only 401. The client code works either way, because `HeyApiError` already carries `message`. Flagged to the user.
- `skills/linear/SKILL.md` fails `bun run format:check` on `main`, from a stray trailing newline in `72add7aef`. A repo-wide `bun run format` fixed it as a side effect; that was reverted to keep the diff traceable, and the pre-existing failure was named to the user instead.
- No mobile counterpart, despite the parity rule in `apps/AGENTS.md`. There is no domain for the app to migrate between.

## Changes in 212ea9048 with unknown provenance

These are in the commit but were not made in this thread, and it is not known whether they came from the user directly or from another agent. The rationale below is read off the commit message and the diff.

- The attempt marker became a timestamp with a ten-second window, and `redirectToNewDomain` and `redirectAlreadyTried` both take `now: Date`. The agent's version stored a boolean flag that never expired. Stated rationale: a bounce returns within one navigation and lands inside the window, while an old bookmark opened later in the same tab is a fresh try and should still be moved.
- `AccountStep` gained the give-up wording and link inline, shown when a hop has already bounced, and its `error` state widened from `string | null` to `ReactNode`. The agent's version always redirected on the server's refusal.
- `server/test/auth.cookie.e2e-spec.ts` gained four cases for the login block: refused on the legacy host, refused on a legacy host carrying a port, allowed on the new domain, allowed for a header session. The agent added no server-side test, on the grounds that `auth.controller.ts` had no spec and the branch was thin.
