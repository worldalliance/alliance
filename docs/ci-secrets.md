# CI secrets

`./.github/actions/aws` lets a job assume an IAM role through GitHub's OIDC token and read the secrets it uses from AWS SSM Parameter Store. Values that aren't secret, such as bucket names and Slack channel ids, are committed in `.github/ci.env`.

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

The action masks every value in the logs, failing if a name is missing from Parameter Store, and loads `.github/ci.env` into the job's environment. The role's AWS credentials stay inside the action unless `export-credentials: true`, which jobs calling S3 or Run Command themselves set. `id-token: write` still lets any step in the job assume the role and read everything it is granted, so code the job runs, such as dependencies' install scripts or an agent, can too. A secret such code must not reach gets its own role behind a GitHub environment that only the job holding it names, as `PR_SCREENSHOTS_GH_TOKEN` and Run Command on the hosts do. The visual regression jobs, whose code is third-party or, for an iOS dispatch, from any ref, get a role holding only the visual regression buckets and keys, trusted only for their workflows on `main` and `production`; like any job on a branch that names no environment, they can also assume the review role.

## When it fails

- `Could not assume role` / `Not authorized to perform sts:AssumeRoleWithWebIdentity`: the job's branch, environment or event doesn't match the role's trust policy, or the job lacks `id-token: write`.
- `not in Parameter Store: …`: the parameter is missing, or misspelled in the workflow.
- `AccessDeniedException` on `GetParameters`: the role isn't granted that name in `terraform/ci-oidc.tf`.
