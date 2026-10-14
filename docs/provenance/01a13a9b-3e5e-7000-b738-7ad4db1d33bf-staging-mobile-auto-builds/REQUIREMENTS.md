---
user: Charles Lien
task: Pushing a new staging fingerprint to main builds the staging mobile apps and ships them to testers automatically
---

## Requirements

### Trigger

- A push to `main` whose staging fingerprint (the EAS runtime version computed with `APP_VARIANT=staging`) has no staging build yet builds the staging app for that platform and submits it to testers. (user-originated)
- A push whose fingerprint differs from the one the platform's most recent staging build runs also builds, as when a native change is reverted to an earlier fingerprint, so testers' newest build always matches the runtime OTA updates target. (agent-proposed, user-approved)
- Nothing in the pipeline waits for a manual approval: no review gate, no draft release, no store-console click. (user-originated)
- Staging only. Production store builds, submission, and `fingerprint:promote` stay manual. (agent-proposed, user-approved)
- iOS and Android are handled independently: each platform builds only when its own staging fingerprint has no build, and one platform's failure does not block the other's submit. (agent-proposed, user-approved)
- A build is triggered by a new fingerprint only. A change to `version` in `apps/mobile/app.config.js` without a fingerprint change does not trigger a build, so the staging app's displayed version can lag production by a release. (agent-proposed, user-approved)
- The build starts only after the staging backend deploy (`deploy-nest-backend` in `.github/workflows/deploy.yaml`) succeeds; a failed backend deploy means no build. (agent-proposed, user-approved)
- When a newer fingerprint for a platform lands on `main` while that platform's staging build for an older fingerprint is running, the older build is cancelled and only the newest is submitted. (agent-proposed, user-approved)

### Manual trigger

- A manual run (`workflow_dispatch`) builds and submits staging for iOS, Android, or both, even when a build for the current fingerprint already exists. (agent-proposed, user-approved)
- A manual run builds only the current HEAD of `main`. (agent-proposed, user-approved)
- A manual run fails unless the staging backend deploy of `main`'s HEAD succeeded, as an automatic build requires. (agent-proposed, user-approved)

### Builds and delivery

- Builds run on GitHub-hosted runners with `eas build --local`, not on EAS cloud build servers. (user-originated)
- iOS: the build is uploaded to the staging app in App Store Connect (app ID `6819396166`) and reaches TestFlight testers automatically once processed, as manual Transporter uploads do today. No step assigns it to a tester group. (user-originated)
- Android: the build is submitted to the staging app's Play internal testing track with release status `completed`, so internal testers get it without a Play Console rollout. (agent-proposed, user-approved)
- No release notes: TestFlight "What to Test" and Play release notes stay empty. (agent-proposed, user-approved)
- The built `.ipa` and `.aab` are not kept as GitHub Actions artifacts: this repository is public, so any signed-in GitHub user could download them. TestFlight and Play internal testing keep every submitted build. (agent-proposed, user-approved)
- A build that runs longer than 60 minutes (iOS) or 45 minutes (Android) fails. (agent-proposed, user-approved)

### Remembering what was built

- After a platform's submit succeeds, CI records that its fingerprint was built with a git tag `staging-build/<platform>/<fingerprint>`, e.g. `staging-build/android/bf5e01172672f7eeb65b15a951f7eb07524e7905`. A push whose fingerprint is the platform's most recently tagged build does not build that platform. (agent-proposed, user-approved)
- When this ships, tags are created for the staging builds already uploaded by hand: iOS `3fc25ecb2c2462212154c80391af89295e0a0a9f` and Android `bf5e01172672f7eeb65b15a951f7eb07524e7905`, so the first automatic build happens on the next native change. (agent-proposed, user-approved)

### Failures

- A failed build, submit, or tag write, including a timeout, posts to the deployment Slack webhook (`SLACK_WEBHOOK_URL_DEPLOYMENT`) with a link to the run, mentioning the person who pushed or started the run. Successful builds post nothing. (agent-proposed, user-approved)

### Credentials

- The App Store Connect API key and the Google Play service account are GitHub Actions secrets on the `staging` environment. CI writes them to temporary files for `eas submit` and deletes the files afterwards. (agent-proposed, user-approved)
- The credentials are set up; the user completed these steps (agent-proposed, user-completed):
  - App Store Connect → Users and Access → Integrations → App Store Connect API → Team Keys: a key with the App Manager role. Its key ID, issuer ID, and base64-encoded `.p8` are the `staging` environment secrets `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID`, and `ASC_API_KEY_P8_BASE64`.
  - Google Cloud: a service account `github-staging-release` ("GitHub staging release"), with no Cloud roles, described as "Uploads staging Android builds to Play internal testing from GitHub Actions (worldalliance/alliance, build-staging-mobile.yaml). Key stored as the PLAY_SERVICE_ACCOUNT_JSON secret on the staging environment." The Google Play Android Developer API is enabled on its project. Its JSON key is the `staging` environment secret `PLAY_SERVICE_ACCOUNT_JSON`.
  - Play Console → Users and permissions: the service account is invited with access to the staging app (`com.alliance.alliancemobile.staging`) only, with "Release to testing tracks" and "View app information".
  - App Store Connect → staging app → TestFlight: the internal tester group distributes builds automatically.

### Cleanup

- The "Staging app needs a rebuild" warning step in `.github/workflows/publish-mobile-ota.yaml` is removed. (agent-proposed, user-approved)
