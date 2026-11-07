# CI secrets

No workflow reads a GitHub secret other than the `GITHUB_TOKEN` Actions issues each run; the old repository secrets stay until ALL-1965 deletes them. Each job that needs AWS assumes an IAM role through GitHub's OIDC token and reads the secrets it uses from AWS SSM Parameter Store. Values that aren't secret, such as bucket names, Slack channel ids and the hosts' instance ids, are committed in `.github/ci.env`.

## Roles

`terraform/ci-oidc.tf` defines seven roles. A role's trust policy decides which jobs can assume it; GitHub's environment branch rules gate the same jobs on GitHub's side.

| Role                            | Assumed by                                                                                 | Can read                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `alliance-ci-review`            | any run on a branch ref (push, dispatch, schedule, …), and pull requests from this repo    | `ci/review/*`, `ci/shared/*`                                                         |
| `alliance-ci-pr-screenshots`    | the PR screenshots `post` job, in the `pr-screenshots` environment                         | `ci/pr-screenshots/*`                                                                |
| `alliance-ci-visual-regression` | the visual regression jobs: iOS, dispatched from `main`, and the deploy's, on `production` | `ci/visual-regression/*`                                                             |
| `alliance-ci-staging`           | jobs in the `staging` environment running on `main`                                        | `ci/deploy/*`, `ci/visual-regression/SLACK_BOT_TOKEN`, `ci/shared/*`, `staging/ci/*` |
| `alliance-ci-production`        | jobs in the `production` environment on `main` or `production`                             | `ci/deploy/*`, `ci/visual-regression/SLACK_BOT_TOKEN`, `ci/shared/*`                 |
| `alliance-ci-staging-hosts`     | the host-deploy jobs, in the `staging-hosts` environment on `main`                         | nothing; runs Run Command on the staging host                                        |
| `alliance-ci-production-hosts`  | the host-deploy jobs, in the `production-hosts` environment on `production`                | nothing; runs Run Command on the production host                                     |

Every trust policy also pins the repository and its owner by numeric id. A pull request from a fork gets no OIDC token, so it reads nothing. No CI role reads the backends' secrets under `/alliance/<env>/server/` (see `docs/backend-secrets.md`).

Each role is granted its parameters by name, so a new parameter needs its name added to the role's list in `terraform/ci-oidc.tf`, and an apply, before any job can read it.

## Reading a secret in a workflow

The job needs `permissions: id-token: write`, and since naming any permission drops the rest, every other permission it uses (`contents: read`, …). Then:

```yaml
- name: Read CI secrets
  id: aws
  uses: ./.github/actions/aws
  with:
    role: review
    parameters: ci/review/OPENAI_API_KEY

- run: ...
  env:
    OPENAI_API_KEY: ${{ fromJSON(steps.aws.outputs.secrets).OPENAI_API_KEY }}
```

The action masks every value in the logs, failing if a name is missing from Parameter Store, and loads `.github/ci.env` into the job's environment. The role's AWS credentials stay inside the action unless `export-credentials: true`, which jobs calling S3 or Run Command themselves set. `id-token: write` still lets any step in the job assume the role and read everything it is granted, so code the job runs, such as dependencies' install scripts or an agent, can too. A secret such code must not reach gets its own role behind a GitHub environment that only the job holding it names, as `PR_SCREENSHOTS_GH_TOKEN` and Run Command on the hosts do. The visual regression jobs, whose code is third-party or, for an iOS dispatch, from any ref, get a role holding only the visual regression buckets and keys, trusted only for their workflows on `main` and `production`; like any job on a branch that names no environment, they can also assume the review role. The deploy's React build has no role; `upload-react-sourcemaps`, a job of its own, uploads its source maps with the environment's. The mobile builds, the staging store build and `publish-mobile-ota`, run the app's dependencies in jobs holding their environment's role, so that code can read everything the role grants (the Expo token, the PostHog sourcemap key, the Slack tokens and, for staging, the App Store Connect and Play keys) and write the CI storage bucket, visual regression baselines included. It could reach the store keys before too, through `eas submit`, which loads the app's config plugins with those keys in its environment (ALL-2082).

## Deploying to the hosts

The deploy jobs hand their files (build zips, nginx vhosts) and script to a host through `./.github/actions/run-on-host`, in the `staging-hosts` or `production-hosts` environment, whose role alone may run commands on the host. The action assumes that role for three hours, uploads them to the deploy artifacts bucket (objects expire after a day), then runs SSM Run Command (`AWS-RunShellScript`) on the environment's instance. On the host, the script runs from `~/` as `ec2-user` in a login shell, with the files copied into `~/`. The step prints the script's output once it ends and fails if the script exited nonzero or timed out. A script that reaches its timeout gets SIGTERM and 15 minutes to exit, long enough for `deploy_backend.sh` to restore the backend on its stop-first path, the only one that traps signals (ALL-2052).

Cancelling the GitHub job doesn't stop a script already running on the host; the next run's same job waits for it before copying its files. A waiting command exits without deploying once it gets the lock if the same job sent another command after it, from a newer run or a re-run, so a cancelled older run never lands after a newer one, even when the host's SSM agent was offline and receives both at once. To watch one: **Systems Manager → Run Command → Command history**, or `aws ssm list-commands --instance-id <id>`. `aws ssm cancel-command` marks it Cancelled, but the script runs on in the process group `timeout` gives it, holding the host lock, until it exits or reaches its timeout and recovery window. Its output goes to `/tmp/run-on-host-<job>.*` on the host, where a cancelled command leaves it. To stop it sooner, send SIGTERM to that `timeout` process on the host, which leaves `deploy_backend.sh` the recovery its stop-first path has.

For Run Command, each host's role gets only the SSM agent's actions, read access to its own environment's prefix of the artifacts bucket, and write access there for Run Command's output (`terraform/deploy.tf`). It doesn't use AWS's `AmazonSSMManagedInstanceCore` policy, which would let the staging host read production's parameters.

## Adding or rotating a secret

Signed in to AWS as an admin, put the parameter as a SecureString, from a file only you can read with no trailing newline (`docs/backend-secrets.md`):

```bash
aws ssm put-parameter --region us-west-2 --type SecureString --overwrite \
  --name /alliance/ci/<review|pr-screenshots|visual-regression|shared|deploy>/<NAME> --value file://value.txt
rm value.txt
```

Staging's app store keys live under `/alliance/staging/ci/`. The next workflow run reads the new value. A new name also needs adding to its role in `terraform/ci-oidc.tf`.

## When it fails

- `Could not assume role` / `Not authorized to perform sts:AssumeRoleWithWebIdentity`: the job's branch, environment or event doesn't match the role's trust policy, or the job lacks `id-token: write`.
- `not in Parameter Store: …`: the parameter is missing, or misspelled in the workflow.
- `AccessDeniedException` on `GetParameters`: the role isn't granted that name in `terraform/ci-oidc.tf`.
- `send-command` fails with `InvalidInstanceId`, or the deploy step ends `TimedOut (DeliveryTimedOut, exit -1)`: the host's SSM agent isn't registered or online. Check **Systems Manager → Fleet Manager**; on the host, `sudo systemctl status amazon-ssm-agent`.
