# Local secrets

Local dev and agents read secrets from AWS SSM Parameter Store under `/alliance/dev/<consumer>/`, using each person's IAM Identity Center login. `scripts/with-secrets.sh <consumer> <command>` reads them when the command starts and runs it with them as env vars. It keeps no copy. The commands that need secrets already call it: the root `server:dev`, and `dev` and `repl` in `server/`. The Linear skill tells agents to run their Linear calls through it. Frontend, admin, migrations and tests need no login. Without a login at all, see [Without team credentials](#without-team-credentials).

Consumers and their keys are listed in `scripts/dev-secrets.json`: `server` and `devtools`.

## Set up, once per machine

An admin first adds you to the `alliance-dev` group in the IAM Identity Center console, under Groups. Then install the AWS CLI and create the profile. Choose the `alliance-dev` role when asked, and name the profile `alliance-dev`:

```bash
aws configure sso --profile alliance-dev
```

Use `https://d-9267f02755.awsapps.com/start` as the start URL and `us-west-2` as the region.

## Log in

```bash
aws sso login --profile alliance-dev
```

A login lasts 24 hours. An admin sets that in the Identity Center console under Settings → Authentication; no API or Terraform resource manages it.

## Failure messages

- `your AWS login has expired or is missing`: run the login command.
- `the alliance-dev AWS profile is not set up`: do the setup above.
- The `alliance-dev` role isn't offered when you configure the profile: an admin adds you to the `alliance-dev` group in the IAM Identity Center console, under Groups.
- `your alliance-dev login may not read`: an admin checks that you are in the `alliance-dev` group in the IAM Identity Center console, under Groups.
- `/alliance/dev/<consumer>/ is missing X`: the key is in `scripts/dev-secrets.json` but not in the store. Add it (below).
- `ignoring X ..., which scripts/dev-secrets.json does not list`: a newer checkout uses X; the command runs without it.
- `did not return SSO session credentials`: the `alliance-dev` profile holds static keys; recreate it with `aws configure sso` (setup above).
- `X already set in this shell`: unset it, so the store is the only source.
- `unset AWS_ACCESS_KEY_ID` or `remove AWS_ACCESS_KEY_ID from <env file>`: static keys would replace your login for everything the command starts. For the server, the wrapper checks `server/.env` and the `.local`, `.development` and `.development.local` files beside it, which Bun loads too.

A running server keeps the secrets it started with. Its S3 access follows your login, so when the login ends the server can exit with `Token is expired ... run 'aws sso login'`. Log in and start it again.

## Add or change a secret

1. Put the value in the store, from a file in `.scratch/`, which git ignores, so it stays out of shell history. The CLI stores the file byte for byte, so first strip the newline an editor or `echo` leaves at its end:

```bash
perl -pi -e 'chomp if eof' .scratch/value.txt
aws ssm put-parameter --region us-west-2 --type SecureString --overwrite \
  --name /alliance/dev/<consumer>/<NAME> --value file://.scratch/value.txt
rm .scratch/value.txt
```

2. Add the name under its consumer in `scripts/dev-secrets.json`, and for `server` to the schema in `server/src/config/env.ts`, both its fields and `setFor[NodeEnv.Development]`, and to `teamOnlyKeys`, so contributors without team credentials don't need it. Server tests compare both lists with the manifest.

The order matters because the store is shared: the wrapper fails when a key the manifest lists is missing from the store, and checkouts whose manifest doesn't list it yet ignore it. The daily login can only read, so step 1 needs an admin login. The `parameter-drift` workflow fails when the store and the schemas disagree, so it reports the new key until step 2 merges.

To remove a secret:

1. Move it from `secrets` to `retiring` under its consumer in `scripts/dev-secrets.json`, and for `server` drop it from `setFor[NodeEnv.Development]` and `teamOnlyKeys`, which server tests compare with the manifest. Remove it from the server schema too only if `inDeployedStore` in `server/src/config/env.ts` keeps it out of the staging and production paths; otherwise follow the removal steps in [backend-secrets.md](backend-secrets.md), since dropping the field makes those paths report it as not in `inDeployedStore`.
2. Once that merges, delete the parameter. Branches and worktrees from before the merge still list it under `secrets`, so deleting it stops their server from starting until they merge `main`; tell the team before you delete it.
3. Drop it from `retiring`.

The `parameter-drift` workflow allows a `retiring` key in the store without requiring it, and the wrapper neither requires nor loads it, so the workflow stays green through each step.

Only secrets go in the store. Non-secret development settings are in `developmentEnv` in `common/src/deployed-config.ts`, and per-checkout keys (`DB_*`, `APP_URL`, `ADMIN_URL`, `NODE_ENV`, `TZ`) stay in `server/.env`. Per-person keys, such as `POSTHOG_API_KEY`, stay in `.env.devtools`.

## Without team credentials

Someone without an `alliance-dev` login, such as an outside contributor, runs the server without the team's secrets:

```bash
bun scripts/setup-without-team-secrets.ts
```

It creates `server/.env` from `server/.env.example` if needed, then appends `ALLIANCE_WITHOUT_TEAM_SECRETS=1`, random `JWT_SECRET` and `JWT_REFRESH_SECRET`, and a seeded admin (`ADMIN_USER`, `ADMIN_PASSWORD`), printing the admin's login. It changes nothing if your shell, `server/.env` or its `.development`, `.local` or `.development.local` sibling already sets any of them, even to a blank value.

With the flag set, `with-secrets.sh` skips Parameter Store, and development stops requiring the keys in `teamOnlyKeys` in `server/src/config/env.ts`. The server logs which of them are unset, and the code using each runs without it, as on any server missing that key. Stored files are off: uploads and reads answer 503, and post export leaves out images. `SEND_DEV_NOTIFS=1` still requires the mail and Twilio keys. Staging and production refuse to start with the flag, and tests ignore it.

A team member never sets it: a missing key should stay a startup error.

## Staging and production secrets

The daily login can't read them; [backend-secrets.md](backend-secrets.md) covers them.

## Old copies in `.env` files

Each checkout and worktree may still hold the shared dev secrets in plaintext from before Parameter Store. The wrapper's values take precedence over them; delete them: from `server/.env` every key `server/.env.example` doesn't list, and from `.env.devtools` `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `AGENT_CHATS_AWS_ACCESS_KEY_ID` and `AGENT_CHATS_AWS_SECRET_ACCESS_KEY`. Without team credentials, keep what `scripts/setup-without-team-secrets.ts` wrote. `scripts/new-worktree.sh` leaves out of a new worktree's copies only the keys `scripts/dev-secrets.json` lists, static AWS keys and `AGENT_CHATS_AWS_*` keys. It leaves out none from `server/.env` when `ALLIANCE_WITHOUT_TEAM_SECRETS` is `1` or `true` as `with-secrets.sh` reads it: from your shell, otherwise from the last of `server/.env` and its `.development`, `.local` and `.development.local` siblings that sets it. It still copies a secret that has left the list or sits in a commented-out line.
