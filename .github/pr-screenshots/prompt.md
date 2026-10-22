# PR screenshots

Take screenshots or videos of every user journey this PR changes, before and after the change, and write them up as one PR comment. You're running headless in GitHub Actions, and nobody will answer questions.

## Environment

Everything here is ephemeral, and you have permission to do whatever you need inside this runner, including `git checkout` between the base and head commits. Don't push, don't open or comment on PRs, and don't call the GitHub API. You have no token for it, and a later job posts your comment.

- Repo checked out at the PR head, full history. `$BASE_SHA` is where the PR branched from its base, `$HEAD_SHA` is the PR head, and `$PR_NUMBER` is the PR.
- Dependencies are installed and playwright's chromium is ready.
- Postgres is running on localhost:5432, and database `alliance` is migrated to the PR head and loaded with the small synthetic seed in `citesting/fixtures/seed_dataonly.sql`, its timestamps shifted to today. `server/.env` points at it, and `psql` connects to it with no arguments. `citesting/src/test-user.ts` has a seeded member you can log in as. When a journey needs data the seed lacks, create synthetic data yourself through the API or `psql`, enough to show the change. There's no S3, so seeded images stored as upload keys don't load on either side. Don't retake a capture because of them.
- Nothing is running yet. `bun $TOOLS_DIR/servers.ts up <service>...` stops every server, starts the ones named, and returns once each answers and has compiled its first page: `server` (API on 3005), `frontend` (5173), `admin` (5174), `mobile-web` (react-native-web on 8085), `mobile` (Metro for the emulator on 8085). `down` stops them all. Stop servers only through it: a process-name pattern can match and kill your own process. Logs are in `$TOOLS_DIR/run/`.
- `bun $TOOLS_DIR/token.ts <email>` prints an access token for that user. `skills/playwright/` and its `MOBILE.md` explain where it goes and how to drive each app. Ignore anything in them about worktrees or starting servers.
- An Android emulator is booted (`adb devices`). A debug dev-client build of the mobile app, whose native code matches the PR head, is installed as `com.alliance.alliancemobile.dev`. It loads JS from Metro, so the same install shows the base or head code depending on the checkout Metro serves. `servers.ts up mobile` points the app at Metro and the API and relaunches it with a fresh bundle. `adb exec-out screencap -p`, `adb shell screenrecord`, and `maestro` are available. For static mobile UI, react-native-web is faster. Use the emulator when react-native-web would misrepresent the change: animations, gestures, native modules, platform styling.
- `ffmpeg` is installed for converting and trimming recordings.

## Output

Write everything to `$OUTPUT_DIR`:

- `comment.md`: the comment body. Reference each asset as `./<filename>`, e.g. `![after](./settings-after.png)`, and the posting job replaces those references with uploaded URLs. Open with one sentence on what changed for someone using the app. Captions and prose say what a reviewer sees; leave identifiers, file names, and capture technique to a collapsed `<details>` at the end, together with the test data you created. Put screenshots in tables, before and after side by side. Put each video on its own line outside any table, since GitHub only embeds a player for a video that stands alone.
- The assets themselves, flat in that directory: `.png` screenshots, `.mp4` videos. Nothing else goes there. GitHub rejects a video over 10 MB, and `adb shell screenrecord` passes that in seconds, so re-encode or trim each `.mp4` under 10 MB with `ffmpeg`.

Keep it to the journeys the diff actually changes. When the PR intends no visible change, such as a refactor, capture a before and after of one representative screen per surface it touches, say in one line whether each pair matches, and show any difference. Capture motion, such as animations, transitions, and interactions, as video, since a screenshot can't show it. If you can't capture something, say so in the comment instead of skipping it quietly.

## Before and after

Create any data you need before the first capture, so both sides show the same rows.

The PR may change dependencies and the schema. After each checkout, run `bun install --frozen-lockfile` in the repo root, `server/`, and `common/`. If the PR adds migrations, revert them before capturing the base: with the head still checked out, run `bunx typeorm-ts-node-commonjs --dataSource src/datasources/dataSource.ts migration:revert` from `server/` once per added migration, and `migration:run` after checking the head back out.

Dev servers don't reliably hot-reload a `git checkout`. After each checkout, rerun `servers.ts up` with every service you use, then reload the page.

Before you write the comment, open every asset and confirm it shows what the comment says. For a PR with a visible change, a before and after that are identical, or that both show the same side of the change, means the capture is wrong. Retake it rather than posting it.
