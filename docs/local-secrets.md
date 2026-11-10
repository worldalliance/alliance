# Local secrets

Local dev and agents read secrets from AWS SSM Parameter Store under `/alliance/dev/<consumer>/`, using each person's IAM Identity Center login. `scripts/with-secrets.sh <consumer> <command>` reads them when the command starts and runs it with them as env vars. It keeps no copy. The commands that need secrets already call it: the root `server:dev`, and `dev` and `repl` in `server/`. The Linear skill tells agents to run their Linear calls through it. Frontend, admin, migrations and tests need no login.

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

2. Add the name under its consumer in `scripts/dev-secrets.json`, and for `server` to the schema in `server/src/config/env.ts`, both its fields and `setFor[NodeEnv.Development]`, which a server test compares with the manifest.

The order matters because the store is shared: the wrapper fails when a key the manifest lists is missing from the store, and checkouts whose manifest doesn't list it yet ignore it. The daily login can only read, so step 1 needs an admin login.

Only secrets go in the store. Non-secret development settings are in `developmentEnv` in `common/src/deployed-config.ts`, and per-checkout keys (`DB_*`, `APP_URL`, `ADMIN_URL`, `NODE_ENV`, `TZ`) stay in `server/.env`. Per-person keys, such as `POSTHOG_API_KEY`, stay in `.env.devtools`.

## Staging and production secrets

The daily login can't read them; [backend-secrets.md](backend-secrets.md) covers them.

## Until the rollout finishes

The rollout fills `/alliance/dev/` with every key `scripts/dev-secrets.json` lists before the wrapper reaches `main`.

`ALLIANCE_SECRETS_ENV_FALLBACK=1` skips Parameter Store and uses the secrets in your `.env` files, printing each key it falls back on, and switches transcript uploads back to the keys `agents/README.md` names. The server reads `server/.env` itself, so for it the wrapper only prints, naming the file Bun takes each key from: `server/.env` or its `.local`, `.development` or `.development.local` sibling. For other consumers it reads the env file with bash's `source`, as the Linear skill did with `.env.devtools`, exports each listed key the shell leaves unset or empty, and fails when bash reports an error in the file or a listed key is missing or empty. It goes away once everyone has run without it.

To run without it, first delete `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `server/.env`, which the wrapper refuses. Once that works, delete from `server/.env` every key `server/.env.example` doesn't list, and `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET`, `AGENT_CHATS_AWS_ACCESS_KEY_ID` and `AGENT_CHATS_AWS_SECRET_ACCESS_KEY` from `.env.devtools`. Do the same in each worktree, since `scripts/new-worktree.sh` copies both files.
