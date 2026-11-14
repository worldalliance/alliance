# Evidence

## Where secret files belong once Infisical is gone

Question: where should secret files that live in Infisical today (an App Store Connect API `.p8` key, and the like) be kept? Researched by a codex subagent on 2026-11-13. It read the repo but not the live Infisical or EAS inventories.

| File | Finding | Source (status) |
| --- | --- | --- |
| App Store Connect API `.p8` | Downloadable once; Apple keeps no copy. Losing it means revoking and issuing a new key. | [Apple](https://developer.apple.com/documentation/AppStoreConnectAPI/creating-api-keys-for-app-store-connect-api) (vendor recommendation) |
| Sign in with Apple `.p8` | Replace with a new key before revoking the old one. | [Apple](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key) (vendor recommendation) |
| Apple `.p12` signing identity | A certificate can be downloaded again but its private key can't; export as password-protected PKCS#12 to share. Provisioning profiles can be downloaded again. | [Apple](https://developer.apple.com/documentation/xcode/sharing-your-teams-signing-certificates), [Apple](https://developer.apple.com/help/account/provisioning-profiles/edit-download-or-delete-profiles/) (vendor recommendation) |
| Android upload keystore | Use Play App Signing with a separate upload key; a lost upload key needs a Play reset. Expo recommends backing up the keystore and its passwords. | [Android](https://developer.android.com/studio/publish/app-signing), [Expo](https://docs.expo.dev/app-signing/security/) (vendor recommendation) |
| Google service-account JSON | Prefer workload identity federation over keys; a key can't be downloaded again but can be replaced. Expo's Play submission still takes a JSON key. | [Google Cloud](https://docs.cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys), [Google Cloud](https://docs.cloud.google.com/iam/docs/keys-create-delete), [Expo](https://docs.expo.dev/submit/android/) (vendor recommendation) |
| APNs `.p8`, FCM JSON | EAS can hold both for Expo Push. | [Expo](https://docs.expo.dev/app-signing/managed-credentials/), [Expo](https://docs.expo.dev/push-notifications/fcm-credentials/) (vendor recommendation) |
| General | Store secrets centrally, grant least privilege, rotate them, and test recovery. | [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) (common practice) |

Stores:

- Parameter Store SecureString holds text up to 4 KB (standard tier) or 8 KB (advanced tier, $0.05 per parameter-month). Base64 adds about a third. [AWS](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-advanced-parameters.html), [AWS pricing](https://aws.amazon.com/systems-manager/pricing/) (vendor documentation), [RFC 4648](https://datatracker.ietf.org/doc/html/rfc4648) (formal standard).
- Secrets Manager holds binary or text up to 65,536 bytes, at $0.40 per secret-month. AWS recommends it over Parameter Store for secrets. [AWS](https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_CreateSecret.html), [AWS pricing](https://aws.amazon.com/secrets-manager/pricing/), [AWS](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) (vendor documentation).
- EAS stores iOS and Android signing and push credentials and can export them. `apps/mobile/eas.json` sets no `credentialsSource`, whose default is `remote`, meaning EAS holds them. [Expo](https://docs.expo.dev/eas/json/), [Expo](https://docs.expo.dev/app-signing/syncing-credentials/) (vendor documentation).
- Team password managers hold files: 1Password up to 2 GB per file, Bitwarden 500 MB attachments. [1Password](https://support.1password.com/files/), [Bitwarden](https://bitwarden.com/help/attachments/) (vendor documentation).

## GitHub secrets against Parameter Store

On 2026-11-13, with an admin AWS login, the agent compared every GitHub repo secret, and every `staging` and `production` secret and variable, against the names under `/alliance/` in Parameter Store (names only, never values). Each name either had a Parameter Store copy, was renamed into committed config (`common/src/deployed-config.ts`, `.github/ci.env`), or had no reference in the repo. `git grep` of `.github` on `origin/main` and `origin/production` found no workflow reading the `secrets` context beyond `GITHUB_TOKEN`.

## Infisical against Parameter Store

On 2026-11-13 the agent read Infisical's Alliance project (dev, staging, prod) and Storage project (dev; staging and prod are empty) through the Infisical API, with the user's CLI login, and compared each value against every parameter under `/alliance/`, in raw and base64-decoded forms, plus `common/src/deployed-config.ts`, `.github/ci.env` and the committed RDS bundle. Only names and match results were printed.

- Storage: the Play service-account JSON, the App Store Connect key `DSNTZQQDQ6`, the Sign in with Apple key `T32B4D3S84` and the Google OAuth client secret each match a parameter. The Apple key `F9J58D7K92`, an old Claude Code OAuth token and the `alliance-gh-bot` recovery codes matched nothing.
- Alliance: 59 entries matched nothing. None is read by the repo except non-secret config (`APP_URL`, `ADMIN_URL`, `DB_HOST`, `DB_USERNAME`, `AWS_REGION`, `TZ`, `PANGRAM_API_URL`, `APPLE_BUNDLE_ID`). The rest are unused, static AWS keys, or `EC2_SSH_KEY`. Its staging and prod copies are identical.
