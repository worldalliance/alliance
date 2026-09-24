# PR screenshots

Take screenshots or videos of every user journey this PR changes, before and after the change, and write them up as one PR comment. You're running headless in GitHub Actions, and nobody will answer questions.

## Environment

Everything here is ephemeral, and you have permission to do whatever you need inside this runner, including `git checkout` between the base and head commits. Don't push, don't open or comment on PRs, and don't call the GitHub API. You have no token for it, and a later job posts your comment.

- Repo checked out at the PR head, full history. `$BASE_SHA` is the base branch tip, `$HEAD_SHA` is the PR head, and `$PR_NUMBER` is the PR.
- Dependencies are installed and playwright's chromium is ready.
- Postgres is running on localhost:5432, and database `alliance` is migrated and loaded with `citesting/fixtures/seed_dataonly.sql`. `server/.env` points at it. `citesting/src/test-user.ts` has a seeded member you can log in as.
- Nothing is running yet. Start what you need on the main checkout's ports: server 3005 (`bun run --cwd server dev`), frontend 5173 (`bun run --cwd apps/frontend dev`), admin 5174, Metro 8085. `skills/playwright/` and its `MOBILE.md` explain how to drive and authenticate. Ignore anything in them about worktrees.
- An Android emulator is booted (`adb devices`). A debug dev-client build of the mobile app, built from the PR head, is installed as `com.alliance.alliancemobile.dev`. It loads JS from Metro, so the same install shows the base or head code depending on the checkout Metro serves. Run `adb reverse tcp:8085 tcp:8085` and `adb reverse tcp:3005 tcp:3005` so the app reaches Metro and the API on localhost. `adb exec-out screencap -p`, `adb shell screenrecord`, and `maestro` are available. Using the emulator is optional. Prefer react-native-web for mobile unless the change is native-only or the web rendering is misleading.

## Output

Write everything to `$OUTPUT_DIR`:

- `comment.md`: the comment body. Put the assets in tables, before and after side by side. Reference each asset as `./<filename>`, e.g. `![after](./settings-after.png)`, and the posting job replaces those references with uploaded URLs.
- The assets themselves, flat in that directory: `.png` screenshots, `.mp4` videos. Nothing else goes there.

Keep it to the journeys the diff actually changes. If you can't capture something, say so in the comment instead of skipping it quietly.
