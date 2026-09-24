## GitHub Actions, not AWS

The Android emulator needs KVM, which `ubuntu-latest` runners provide. On EC2, the emulator needs nested virtualization or bare-metal instances, and iOS needs Mac dedicated hosts with a 24-hour minimum allocation. Public repos get standard runners free. AWS's only advantage, persistent warm caches, is mostly covered by Actions caches.

## Security model: the agent job holds no GitHub credentials

The risk is prompt injection from PR content causing the agent to leak whatever it can reach, because it runs with `--dangerously-skip-permissions` and full Bash. So:

- **Trigger:** labeling a PR `screenshots` triggers a run, only for PRs from branches in this repo, never forks. The first step checks that the labeler has `admin` or `write` access through the collaborators permission API. Triage access can add labels, but that alone doesn't run the agent.
- **The `capture` job** runs with `contents: read`:
  - checkout uses `persist-credentials: false`;
  - the agent step's only secret is `CLAUDE_CODE_OAUTH_TOKEN`, shared with `code-review.yaml` per the follow-up request, so a leak from this agent exposes that token too;
  - it writes assets and `comment.md` to an artifact.
- **The transcript artifact** is public in this repo, and GitHub masks secrets in logs but not in artifacts. A step running even on failure strips `CLAUDE_CODE_OAUTH_TOKEN` from it with a literal `perl` replace. The upload runs only when that step succeeded, so a failed or cancelled redaction publishes nothing. The artifact is kept 7 days.
- **The `post` job** runs no agent. It holds the posting token and runs `gh pr comment`. Its `GITHUB_TOKEN` has no permissions, since nothing in it uses that token.
- Interpolated PR fields (number, SHAs) reach the agent as env vars, never spliced into `run:` scripts. The PR title and body are not passed at all.

## Label trigger instead of `workflow_dispatch`

`workflow_dispatch` only dispatches workflows that exist on the default branch. A `pull_request: labeled` trigger could be tested from the temp PR before merging, and it remains the manual trigger afterward. Removing and re-adding the label re-runs it, and a `concurrency` group cancels the run already in flight for that PR. The group key includes the label name because every label event starts this workflow: without it, adding an unrelated label would cancel a screenshots run.

## Posting needs an org-owned PAT

`gh pr comment --attach` uploads to `uploads.github.com/user-attachments`. The token tests went as follows:

- `GITHUB_TOKEN` failed with "unsupported authentication type".
- A user-owned fine-grained PAT failed with HTTP 403 "Resource not accessible by personal access token", even after Issues and Contents write were added.
- After the user made the organization the PAT's owner, it worked. The comment posts as `alliance-gh-bot`.

The PAT's final permission set is unknown to the agent. The post job fails with an explicit error when `PR_SCREENSHOTS_GH_TOKEN` is unset.

## Environment the workflow prepares for the agent

The workflow does the deterministic setup so the agent spends its turns on capturing:

- Postgres 17 as a service. The `alliance` database is seeded by `citesting/src/seed-database.ts`, the same module citesting's screenshot scripts use: migrations, `citesting/fixtures/seed_dataonly.sql`, then the timestamp shift. Without the shift every seeded deadline is months in the past. The seeder runs before `server/.env` exists, because its guard refuses to drop the database that file names.
- The seed is small, so the prompt tells the agent to create whatever synthetic data a journey needs, before the first capture so both sides show the same rows.
- `server/.env` gets synthetic values and random JWT secrets, with `NODE_ENV=test` as citesting uses, and no AWS, so uploads to S3 won't work and seeded images stored as upload keys don't load. The prompt tells the agent to expect them broken on both sides, so it doesn't spend turns retaking those captures. Under `development` the server crashes at boot without Twilio and PostHog keys.
- Chromium for playwright, Maestro, and ffmpeg.
- Ports are the main checkout's base ports (server 3005, frontend 5173, admin 5174, Metro 8085), since CI isn't a worktree.
- Servers are left for the agent to start, because it restarts them across checkouts anyway.

## Android: one debug dev-client build, JS from Metro

- **The build:** `expo prebuild` with `APP_VARIANT=development`, then `gradlew app:assembleDebug -PreactNativeArchitectures=x86_64` to match the x86_64 emulator. The debug build loads JS from Metro, so a single build of the PR head shows either base or head code depending on the checkout Metro serves.
- **The emulator:**
  - Android 34 `google_apis` x86_64 on a `pixel_7` profile, started in the background before the build so it boots in parallel.
  - `ANDROID_AVD_HOME` is pinned for both `avdmanager` and `emulator`. Left unset, the first run's AVD landed where the emulator didn't look.
  - The step fails immediately if `-list-avds` doesn't show the AVD.
- The install step waits at most 10 minutes for `sys.boot_completed`, so a hung boot fails there instead of at the job timeout.
- **The dev menu:** meta-data added to the AndroidManifest in CI after prebuild hides the dev-menu gear button, skips dev-client onboarding and disables showing the menu at launch. The `expo-dev-launcher` plugin exposes the same settings, but setting them in `app.config.js` would change local dev builds too. The step fails if the patch didn't land, so the menu can't quietly reappear.
- **The APK cache:** the APK is cached under the `@expo/fingerprint` hash of the Android `development` variant, plus the workflow file's hash since the manifest patch lives there. A hit skips roughly 15 minutes of prebuild and Gradle. Actions only lets a PR restore caches from its own ref or the base branch, so today this mostly helps reruns on the same PR. A cache hit can come from an earlier commit of the PR, so the prompt says the install matches the PR head's native code rather than that it was built from the head.

## Prompt lives in `.github/pr-screenshots/prompt.md`

It adapts the old skill for a headless runner: what's already set up, where to write `comment.md` and flat `.png`/`.mp4` assets, and that it must not push, comment or call the GitHub API.

`$BASE_SHA` is the merge base of `pull_request.base.sha` and the head, not the base branch commit itself. The checkout is the unmerged head, so comparing it against a base tip that moved on would show main's newer changes as differences.

Screenshots go in before/after tables, and each video goes on its own line, because GitHub embeds a video player only for a standalone link. This isn't verified against a posted comment.

The database and `node_modules` are prepared at the head, so the prompt has the agent run `bun install` after each checkout and revert the PR's migrations while capturing the base. Otherwise base code runs against the head schema and dependencies.

It gives three rules, each prompted by something that happened in the test runs:

- **Restart servers and Metro after every checkout.** In the second test run, the web "before" and "after" were byte-identical: both showed the head code, and the comment claimed a change. The agent had restored the base file in place without the page reloading.
- **Open every asset and retake any pair that's identical or shows the same side.** This is the other half of the fix for the same failure.
- **Capture motion as video, and use the emulator when react-native-web would misrepresent the change** (animations, gestures, native modules, platform styling). Otherwise react-native-web stays the default for mobile, as `skills/playwright/MOBILE.md` already advises. In the second run the agent skipped the emulator for a text-only change. In the third, with an animated collapsible card, it used the emulator and recorded videos on both platforms.

## Model and output

The agent runs with `--model claude-opus-5-5`, `--output-format stream-json --verbose`, and its output is piped through `tee`. The transcript and emulator log are uploaded as an artifact even when the run fails, for debugging.
