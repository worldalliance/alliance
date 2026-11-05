# Evidence

Research behind the choices in `REQUIREMENTS.md`, gathered 2026-11-05. Two codex research agents were given the setup and the options without the agent's recommendations, and asked for industry practice with each source labeled formal standard, vendor recommendation or common practice. Their reports follow verbatim, apart from absolute local paths shortened to repo paths.

## Verified directly

The claim both reports rest on most was checked against AWS's pages rather than taken from them: AWS STS validates GitHub-specific OIDC claims in role trust policies, announced 2026-02-02 (https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/). The IAM condition key reference (https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html, "Available keys for AWS OIDC federation", GitHub tab) lists `actor`, `actor_id`, `job_workflow_ref`, `repository`, `repository_id`, `repository_owner_id`, `workflow`, `ref`, `environment` and `enterprise_id` under `token.actions.githubusercontent.com:`, none available in the session. AWS's GitHub role guide (https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html) still requires a `sub` condition that isn't only a wildcard. GitHub's own AWS guide still says custom claims are unsupported; AWS's pages are the authority for what AWS checks.

The other links below were collected by the research agents and not opened during this task.

## Report 1: IAM roles, Parameter Store paths, environment branch policies

**I recommend (a) as the baseline, with selective use of (d) for release credentials. Set the proposed GitHub environment branch policies and also enforce those refs in AWS. Customizing `sub` is no longer necessary just to check both environment and branch.**

Research current to **November 5, 2026**. I inspected workflows and read-only repository metadata; nothing was changed. Labels below distinguish standards, vendor guidance/documented behavior, and common-practice recommendations.

**1. IAM roles, Parameter Store paths, and OIDC trust**

The governing requirement is least privilege, not a prescribed role count or directory layout. **Formal standard:** NIST SP 800-53 AC-6 limits users and processes to permissions needed for their tasks. **Common practice:** OWASP applies that principle to individual pipelines and steps and discourages sharing credentials between pipelines with different sensitivity. Three trust-level roles are therefore a pragmatic compromise; per-workflow isolation is stricter. [NIST AC-6](https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf), [OWASP CI/CD guidance](https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html).

The following comparison is my **common-practice assessment** against those principles:

| Option                                         | Assessment for this team                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **a. Roles by trust level; paths by readers**  | Best starting point. Separates review code from deployment credentials without duplicating identical values. Each role still exposes the union of its permissions to every eligible job. |
| **b. Duplicate values under each environment** | Useful when credentials actually differ. Copying the same credential twice adds rotation work without isolating the underlying service access.                                           |
| **c. One role reads everything**               | Reject. A review-job compromise could obtain SSH, publishing, and store credentials.                                                                                                     |
| **d. Per-workflow/job roles**                  | Best permission granularity, with more maintenance. Use selectively for materially different powers, rather than automatically creating one role per YAML job.                           |

AWS likewise recommends narrow grants and separate paths for sensitive values. My proposed layout is an application of that **vendor recommendation**, not an AWS naming standard. [AWS parameter-access guidance](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-restrict-parameter-access.html).

| Path                       | Contents / intended readers                                               |
| -------------------------- | ------------------------------------------------------------------------- |
| `/alliance/ci/review/`     | Claude, OpenAI, review Slack webhook; review jobs                         |
| `/alliance/ci/pr-comment/` | `PR_SCREENSHOTS_GH_TOKEN`; screenshot posting                             |
| `/alliance/ci/shared/`     | Deployment Slack webhook, given its current PR and deployment readers     |
| `/alliance/ci/visual/`     | Visual-regression API keys and Slack bot; visual jobs                     |
| `/alliance/ci/deploy/`     | Shared deployment credentials such as PostHog sourcemap key               |
| `/alliance/ci/mobile/`     | Shared Expo token; mobile build/publish jobs                              |
| `/alliance/staging/ci/`    | Staging-specific host configuration, SSH credential, ASC/Play credentials |
| `/alliance/prod/ci/`       | Production-specific host configuration and SSH credential                 |

Use `alliance-ci-review`, `alliance-ci-staging`, and `alliance-ci-prod` as the initial trust tiers. Explicitly map GitHub environment **`production` → SSM prefix `prod`**. Grant access to listed parameters or coherent subpaths; do not automatically grant every environment role every shared path.

Keep `/alliance/<env>/server/` outside CI permissions. Your existing runtime retrieval through instance roles follows **common practice**: application secrets should reach the application without unnecessarily passing through CI. [OWASP secrets management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet).

Two qualifications matter:

- **Shared storage and shared authority are different.** Given your setup, the same SSH key accepted by both hosts gives staging readers production access. Publicly resolvable production IPs cannot provide the missing boundary. Generate distinct host credentials if staging/production isolation is intended. Likewise, if the shared Expo token can publish production updates, its staging readers retain that power. These are **inferences from your setup**, applying OWASP’s credential-separation guidance above.
- **Three roles do not enforce “only the secrets each job needs.”** Fetching fewer parameters reduces routine exposure, but a compromised eligible job can request everything its role permits. For enforced isolation, split SSH deployment, mobile/store publishing, visual work, and notification permissions where appropriate. Separate role names with identical trust conditions are not workflow boundaries: the job could request another role. Bind privileged roles to a protected reusable workflow or another independently enforced identity boundary. **Vendor recommendation:** GitHub specifically supports reusable workflows for this purpose. [Reusable workflows and OIDC](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows).

Concrete AWS permission choices, all **vendor recommendations/documented behavior**:

- Prefer `ssm:GetParameter` and `ssm:GetParameters` on explicit ARNs, for example `arn:aws:ssm:us-west-2:751910243706:parameter/alliance/ci/review/OPENAI_API_KEY`. Avoid broad `ssm:GetParameter*`: it includes history and path retrieval. `GetParameterHistory` can reveal the current value. [Parameter Store permissions](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-setting-up.html).
- Avoid recursive access to `/alliance` or `/alliance/ci`. `GetParametersByPath` authorizes the requested ancestor path; a deny on an individual descendant does not reliably exclude it from those results. [Path authorization rules](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-restrict-parameter-access.html).
- Use a customer-managed KMS key when you want an independent decryption boundary, with `kms:Decrypt` limited to intended readers. `aws/ssm` does not provide that differentiated key policy; SSM IAM still governs retrieval. Encryption-context conditions can additionally bind decryption to parameter ARNs. [KMS access separation](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-restrict-decryption.html), [Parameter Store encryption context](https://docs.aws.amazon.com/systems-manager/latest/userguide/secure-string-parameter-kms-encryption.html).
- Replace the IAM user’s S3 keys with direct role permissions; do not copy those keys into SSM. Scope object access to the required buckets/prefixes and `ListBucket` with `s3:prefix`; give asset downloads read access and visual uploads the necessary write access. **Vendor recommendation:** workloads should use temporary role credentials. [AWS IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html), [S3 policy examples](https://docs.aws.amazon.com/AmazonS3/latest/userguide/amazon-s3-policy-keys.html).

For OIDC, there is an important **2026 change and documentation disagreement**. AWS announced support for selected provider-specific claims on **February 2, 2026**, across commercial regions. Its current documentation supports direct GitHub `ref`, `environment`, `job_workflow_ref`, `repository_id`, and `repository_owner_id` conditions. GitHub’s AWS guide still says custom claims are unavailable. Follow AWS’s current supported-key list for AWS behavior; support is for listed claims, not arbitrary JWT fields. **Vendor recommendation/documented behavior.** [AWS announcement](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/), [supported condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html#condition-keys-wif), [conflicting GitHub note](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws).

Consequently, this is a suitable **production trust-policy baseline**, assuming the existing name-based default subject:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::751910243706:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:worldalliance/alliance:environment:production",
          "token.actions.githubusercontent.com:repository_id": "968852531",
          "token.actions.githubusercontent.com:repository_owner_id": "214721520",
          "token.actions.githubusercontent.com:ref": [
            "refs/heads/production",
            "refs/heads/main"
          ]
        }
      }
    }
  ]
}
```

For staging, change the subject to `environment:staging` and allow only `refs/heads/main`. The immutable IDs above came from the [repository metadata API](https://api.github.com/repos/worldalliance/alliance). AWS recommends immutable identifiers to protect against name reuse. Its GitHub role-creation guidance still requires a nontrivial `sub` condition, so retain it alongside the newer keys. **Vendor recommendation.** [AWS GitHub trust requirements](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html#idp_oidc_Create_GitHub).

For the review role, retain exact audience/ID checks and use:

```json
"StringLike": {
  "token.actions.githubusercontent.com:sub": [
    "repo:worldalliance/alliance:ref:refs/heads/*",
    "repo:worldalliance/alliance:pull_request"
  ]
}
```

**Vendor recommendation/documented behavior:** use `StringEquals` for exact values and `StringLike` when wildcard matching is intended. Values in the subject list are alternatives; different condition keys must all match. Avoid `repo:worldalliance/alliance:*`, which also admits environment and tag subjects. Do not use `IfExists` for a restriction that must be present. [IAM condition operators](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition_operators.html), [IAM condition evaluation](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html).

Default subject behavior is:

| Job context                                    | Subject suffix after `repo:worldalliance/alliance:` |
| ---------------------------------------------- | --------------------------------------------------- |
| Declares an environment                        | `environment:staging` or `environment:production`   |
| `pull_request`, no environment                 | `pull_request`                                      |
| Branch push or branch dispatch, no environment | `ref:refs/heads/<branch>`                           |

Environment context replaces the ref/PR portion of `sub`; the separate `ref` claim remains available. The review policy therefore trusts matching contexts, not exclusively the three named event types. Environment names are case-sensitive under these comparisons; colons inside subject metadata are encoded as `%3A`. **Vendor recommendation/documented behavior.** [GitHub subject reference](https://docs.github.com/en/actions/reference/security/oidc).

My **common-practice recommendation** is to keep the default template now:

- Direct `ref` conditions solve the environment-plus-branch requirement.
- Direct `job_workflow_ref` conditions can identify **called reusable workflows**, not ordinary jobs. Pin the trusted reusable workflow to a controlled ref or commit and constrain its inputs; otherwise it can become a privileged runner for arbitrary code. [GitHub reusable-workflow guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-with-reusable-workflows).
- A custom template such as `["repo","context","ref"]` remains an alternative. It changes repository-wide subjects and requires coordinated trust-policy updates. Requiring `job_workflow_ref` repository-wide is unsuitable for your many non-reusable jobs. [GitHub customization guidance](https://docs.github.com/en/actions/reference/security/oidc#customizing-the-token-claims).

Another **vendor-documented 2026 change**: repositories created, renamed, or transferred after **July 15, 2026** adopt subjects containing immutable IDs, such as `repo:worldalliance@214721520/alliance@968852531:environment:production`. Existing repositories retain the old format unless opted in. Your repository dates from 2025, but confirm its actual subject format before deploying the example. [GitHub rollout announcement](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/).

Fork behavior needs explicit treatment:

- **Vendor-documented behavior:** ordinary fork `pull_request` runs normally have write permissions downgraded and cannot obtain the requested `id-token: write`; repository secrets are withheld. Approving execution is not equivalent to granting deployment credentials. [Permission calculation](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#how-permissions-are-calculated-for-a-workflow-job), [fork events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request).
- **Common-practice inference:** `repo:worldalliance/alliance:pull_request` itself does **not** prove the PR head belongs to that repository. Keep your existing same-repository guard in [pr-screenshots.yaml](.github/workflows/pr-screenshots.yaml:39), and skip secret retrieval for fork CI.
- **Vendor recommendation:** do not switch to `pull_request_target` merely to obtain credentials while executing PR code. Privileged triggers can run in trusted repository context despite untrusted inputs. [GitHub trigger warning](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target).

Finally, give `id-token: write` only to jobs needing AWS, mask SSM-derived secrets explicitly, and use run-identifiable session names. OIDC expires AWS credentials; it does not expire an SSH key or API token already fetched. **Vendor recommendation/common practice.** [AWS action documentation](https://github.com/aws-actions/configure-aws-credentials), [GitHub secret handling](https://docs.github.com/en/actions/reference/security/secure-use), [OWASP secret lifecycle](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet).

**2. Yes: set environment deployment branch policies alongside OIDC trust.**

Both **GitHub and AWS explicitly recommend environment protection rules when environments appear in OIDC policies**. AWS particularly recommends branch/tag restrictions. These gates control whether the job may proceed, so they remain useful after secrets move out of GitHub. **Vendor recommendation.** [GitHub OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [AWS OIDC guidance](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html#idp_oidc_Create_GitHub).

My **common-practice recommendation**:

| Environment  | Selected allowed branches | AWS `ref` condition |
| ------------ | ------------------------- | ------------------- |
| `staging`    | `main`                    | `refs/heads/main`   |
| `production` | `production`, `main`      | Both exact refs     |

This preserves your production dispatches from `main`. Configure **branch rules**, without corresponding tag permissions. Prefer explicit selections over “Protected branches only”: GitHub documents that the latter permits all branches when no branch-protection rules exist. Environment rules match the workflow’s `GITHUB_REF`. **Vendor-documented behavior.** [Environment branch rules](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#deployment-branches-and-tags).

Three concrete consequences follow:

1. **Allowing `main` makes it production-trusted.** Protect both `main` and `production`, including workflow/deployment-script changes, against unreviewed modification. Branch allowlists alone do not stop someone who can freely push to an allowed branch. This is a **common-practice inference**; GitHub recommends CODEOWNERS review for workflow files. [GitHub workflow review guidance](https://docs.github.com/en/actions/reference/security/secure-use#using-codeowners-to-monitor-changes).

2. **Dispatch ref and checkout ref are different.** `workflow_dispatch` identifies the branch/tag receiving dispatch; an input named `ref` does not change that identity. Your [iOS visual workflow](.github/workflows/mobile-visual-regression-ios.yaml:31) checks out the supplied ref and executes it. A dispatch from allowed `main` can therefore run different code with the job’s AWS authority. Constrain acceptable source commits or isolate that execution from privileged jobs. Your [OTA workflow](.github/workflows/publish-mobile-ota.yaml:44) already checks production-deployment ancestry. **Vendor-documented behavior plus repository-specific inference.** [Dispatch semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch).

3. **Required reviewers are an additional control, not a replacement.** GitHub supports preventing self-review and disabling administrator bypass; one listed reviewer’s approval suffices. These features are available for this public repository. **Vendor-documented behavior.** [Environment reviewers](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments#required-reviewers).

For this team, I would begin with branch allowlists, AWS ref checks, and reviewed changes to the trusted branches. Add required reviewers where you want a second person to authorize production execution. Applying reviewers to the existing `production` environment also gates visual and OTA jobs, so use that deliberately.

Custom `sub` claims remain a workable alternative for cloud-enforced branch restrictions, but direct AWS `ref` conditions now achieve that with less migration work. Neither approach establishes that all code executed by an authorized job is safe. The 2026 OpenSSF analysis of Mini Shai-Hulud reinforces that distinction: legitimate OIDC identities were usable after the runner was compromised. **Common practice:** protect the execution boundary as well as the identity boundary. [OpenSSF analysis](https://openssf.org/blog/2026/06/10/mini-shai-hulud-where-slsas-boundaries-fall/).

## Report 2: non-secret values, SSH versus Run Command, rollout

My recommendations are to **commit stable non-secret CI configuration, keep SSH temporarily while planning a Run Command migration, and apply infrastructure first followed by a few workflow migration batches**. These are judgments for this team, not requirements imposed by a standard.

I reviewed the relevant repository files and current documentation as of November 5, 2026. I made no changes.

**3. Non-secret CI values: prefer committed configuration for this repository.**

**Formal standard:** NIST FIPS 199 classifies information according to the consequences of disclosure, modification, and unavailability. It explicitly recognizes public information with no confidentiality requirement but meaningful integrity requirements. Being deployment configuration does not automatically make a value confidential. [NIST FIPS 199](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.199.pdf)

| Value             | Classification and implications                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INSTANCE_IP`     | **Assessment applying the formal standard:** given your publicly resolvable domains, the EIP is already public information. Protect changes to the deployment destination; hiding the address adds little confidentiality. [FIPS 199](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.199.pdf)                                                                                                                                                                                                                      |
| S3 bucket names   | **Vendor recommendation:** AWS says not to include sensitive information in names because names appear in object URLs. This does **not** mean every bucket name is itself a secret. A name containing customer identities or confidential project information could still be sensitive. [AWS bucket naming guidance](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html)                                                                                                                   |
| Slack channel IDs | **Assessment from vendor documentation:** a channel ID identifies the destination; the bearer token supplies authorization. Ordinary deployment channel IDs are reasonable non-secret configuration. A confidential channel association could warrant different treatment. **Webhook URLs remain secrets.** [Slack messaging authentication](https://docs.slack.dev/messaging/sending-and-scheduling-messages/), [Slack webhook secrecy](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/) |

I found no blanket requirement in these sources that ordinary bucket names or channel IDs must be secret. OWASP’s guidance focuses on protecting credentials, limiting their readers, and managing their lifecycle; it does not establish a universal sensitive-resource-name classification. **Common practice:** classify identifiers by their contents and context. [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

| Storage option                                     | Comparison                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Committed typed configuration / workflow `env`** | **Common practice:** gives reviewable changes, history, and rollback alongside workflow code. Appropriate for deliberately public values; avoid copying shared values across workflows. AWS recommends version-controlling operational configuration. [AWS operational guidance](https://docs.aws.amazon.com/wellarchitected/2022-03-31/framework/oe-design-principles.html)                                                                                   |
| **GitHub repository/environment variables**        | **Vendor recommendation:** explicitly designed for non-sensitive configuration, including server names. Good for operator-managed values that change independently of code. They render unmasked, and changing a Git commit does not revert repository settings. [GitHub variables](https://docs.github.com/en/actions/concepts/workflows-and-actions/variables)                                                                                               |
| **Parameter Store**                                | **Vendor recommendation:** supports ordinary configuration as `String`, including URLs and resource identifiers. Useful when AWS workloads and CI share configuration; unnecessary authentication and retrieval work for CI-only public constants. `SecureString` is not required simply because adjacent parameters contain secrets. [AWS Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html) |

**My recommendation:** follow the repository’s existing [typed deployment configuration pattern](common/src/deployed-config.ts), with a small CI-specific configuration where appropriate. Store common bucket/channel values once and deployment addresses by environment. Prefer the existing DNS name over duplicating its EIP where that name reliably identifies the SSH host.

GitHub variables are an equally defensible alternative if changing these values without a PR is an actual operational need. There is no security standard selecting one of these two storage mechanisms.

**4. EC2 deployment access: use Run Command as the destination; keeping SSH for this migration is reasonable.**

**Common practice:** reduce reusable credentials and narrowly scope automation identities. **Vendor recommendation:** AWS promotes Systems Manager access without inbound management ports or persistent SSH keys and explicitly identifies Run Command as suitable for deployment pipelines. These sources support that direction without requiring every existing SSH deployment to be replaced immediately. [OWASP secrets guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [AWS Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html), [AWS Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html)

| Option                                    | Practical tradeoffs                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Long-lived SSH key in Parameter Store** | **Assessment:** smallest change to your existing appleboy steps. OIDC protects retrieval, but a copied private key remains usable until host authorization is removed or changed. Moving storage does not make the SSH credential temporary. [OWASP credential lifecycle guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)                                                                                                             |
| **SSM Run Command**                       | **Vendor-supported approach:** IAM-controlled remote execution, suitable for CI. Replace SCP with artifact upload to S3 and download on the host using its instance role. Requires managed-node setup and explicit execution/status handling. [AWS Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html), [running scripts from S3](https://docs.aws.amazon.com/systems-manager/latest/userguide/integration-s3.html)                        |
| **Session Manager**                       | **Vendor-supported approach:** useful for interactive administration. SSH/SCP through its tunnel preserves existing tools and removes inbound-port requirements, but still uses SSH authentication; the tunnel alone does not eliminate SSH keys. SSH/forwarding session contents cannot be logged by Session Manager. [AWS SSH through Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-getting-started-enable-ssh-connections.html) |
| **EC2 Instance Connect**                  | **Vendor-supported approach:** generate an ephemeral key and authorize its public key through IAM. The public key is available for **60 seconds to establish a connection**, not a 60-second session limit. Direct connections still require network access to SSH. [AWS Instance Connect](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-connect-methods.html)                                                                                                  |

Instance Connect Endpoint can avoid public SSH exposure while retaining SSH/SCP, but it adds endpoint/network configuration. Connections have a maximum one-hour duration, and AWS says the endpoint is intended for management traffic rather than high-volume transfers. That makes S3 preferable for substantial build artifacts. **Vendor recommendation.** [AWS Instance Connect Endpoint](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-with-ec2-instance-connect-endpoint.html)

For a Run Command follow-up, account for these concrete pitfalls:

- **Host prerequisites:** reading Parameter Store through an instance role does not establish that SSM Agent is installed, registered, and reachable. Managed nodes need appropriate permissions and outbound HTTPS connectivity to Systems Manager endpoints. **Vendor recommendation.** [AWS managed-node troubleshooting](https://docs.aws.amazon.com/systems-manager/latest/userguide/fleet-manager-troubleshooting-managed-nodes.html)
- **Execution identity:** SSM Agent runs with root privileges on Linux. Explicitly execute application deployment work as `ec2-user`, preserving its home, Bun/Node paths, and PM2 context. Restrict `SendCommand` to the intended instances and documents. **Vendor recommendation plus application to your script.** [AWS root-command restrictions](https://docs.aws.amazon.com/systems-manager/latest/userguide/ssm-agent-restrict-root-level-commands.html), [deploy_backend.sh](scripts/deploy_backend.sh)
- **Completion and errors:** poll the specific instance invocation, require success, and propagate script failures. A successful submission is not a successful deployment; by default, the last shell command determines the script’s reported exit code. **Vendor recommendation.** [AWS command statuses](https://docs.aws.amazon.com/systems-manager/latest/userguide/monitor-commands.html), [exit-code handling](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command-handle-exit-status.html)
- **Timeouts and output:** distinguish delivery, execution, and GitHub job timeouts. The default CLI `command-executed` waiter gives up after roughly **100 seconds**; that is not the remote execution timeout. API output is truncated, so configure S3 or CloudWatch output for complete logs. **Vendor documentation.** [CLI waiter](https://docs.aws.amazon.com/cli/latest/reference/ssm/wait/command-executed.html), [invocation output](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_GetCommandInvocation.html)

**My recommendation:** complete OIDC and secret retrieval with the existing SSH deployment, then replace SSH/SCP with **S3 artifacts plus Run Command**, retaining Session Manager for human administration. Your roughly ten transport steps and existing deployment/rollback script make this a distinct, testable change. Separating it follows AWS’s preference for small, reversible changes. [AWS change guidance — vendor recommendation](https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_freq_sm_rev_chg.html)

**5. Rollout: infrastructure first, followed by a few workflow batches.**

The relevant guidance establishes sequencing and validation, not a required number of PRs:

- **Formal standard/control catalog:** NIST CM-3 and CM-3(2) call for controlled changes and testing, validation, and documentation before finalizing implementation. They do not prescribe PR boundaries. [NIST SP 800-53](https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-53r5.pdf)
- **Vendor recommendation:** AWS favors small, reversible changes. Its OIDC guide orders provider creation, role/trust configuration, minimum permissions, workflow integration, and CloudTrail auditing. GitHub likewise establishes cloud trust before workflow use. [AWS change guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_freq_sm_rev_chg.html), [AWS OIDC guide](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/), [GitHub AWS OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)
- **Common practice:** expand-migrate-contract introduces the new mechanism while preserving the old, migrates consumers, then removes the old mechanism. Migration can be incremental or brief. [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)

| Option                                                                 | Assessment applying that guidance                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One PR; admin applies Terraform before merge; old secrets retained** | **Valid expand-migrate-contract.** Infrastructure expands before consumers switch, and deletion is deferred. Separate commits help review and selective rollback, but merging them together still switches all affected workflows together. |
| **Terraform PR, then workflow PRs**                                    | **Recommended here.** Separates infrastructure readiness from consumer failures and allows testing different trigger/environment combinations.                                                                                              |
| **One workflow at a time**                                             | Smallest failure scope, but unnecessary overhead for every mechanically identical workflow. Best used for an initial pilot and unusual cases.                                                                                               |

The comparison above is my application of [AWS’s small-change guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_freq_sm_rev_chg.html) and [expand-migrate-contract](https://martinfowler.com/bliki/ParallelChange.html), not a vendor-mandated PR structure.

I would use this sequence:

1. **Expand:** review/apply Terraform, establish environment restrictions, populate Parameter Store, and retain existing GitHub secrets. Keep the one-time copying identity separate from normal read-only CI roles.
2. **Migrate:** exercise a controlled pilot, then migrate related workflows in batches. Cover staging and production deploys, production dispatch from `main`, branch-push reviews, same-repository PRs, fork PRs, and mobile jobs. Check both allowed operations and expected denials.
3. **Contract:** after those paths succeed, remove obsolete references and GitHub secret copies. Deactivate and ultimately delete the replaced IAM access key after checking other consumers. Set a concrete cleanup condition so coexistence does not become permanent.

That sequence applies the [AWS OIDC migration guidance — vendor recommendation](https://aws.amazon.com/blogs/security/use-iam-roles-to-connect-github-actions-to-actions-in-aws/) and [parallel-change pattern — common practice](https://martinfowler.com/bliki/ParallelChange.html).

The important implementation pitfalls are:

- **Production trust must accommodate your actual callers.** With legacy name-based subjects, an environment job uses `repo:worldalliance/alliance:environment:production`; a non-environment branch job uses `repo:worldalliance/alliance:ref:refs/heads/main`; a non-environment PR job uses `repo:worldalliance/alliance:pull_request`. The environment form replaces the branch/PR suffix. **Vendor documentation.** [GitHub OIDC reference](https://docs.github.com/en/actions/reference/security/oidc)

- **There is a material 2026 documentation disagreement.** AWS announced support for selected GitHub-specific claims on **February 2, 2026**, including directly usable `:ref` and `:environment` conditions. GitHub’s AWS guide still says custom claims are unavailable. For AWS enforcement, follow the current AWS documentation: require the correct audience and subject, and restrict each role’s `ref` to its real callers. Production dispatch roles need `main`; production deployment roles may need `production`. These additional claims are trust-policy inputs, not carried into the resulting session for ordinary resource authorization. **Vendor documentation; AWS supersedes the conflicting GitHub statement here.** [AWS announcement](https://aws.amazon.com/about-aws/whats-new/2026/01/aws-sts-supports-validation-identity-provider-claims/), [AWS supported condition keys](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_iam-condition-keys.html), [conflicting GitHub guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws)

- **Protect the environments as well.** For your existing production dispatches, a production environment branch policy must admit `main` as well as `production`. Declaring `environment: production` alone provides no branch restriction. Also, checking out an input SHA does not change the triggering ref represented in the token. **Vendor recommendation and application to your workflows.** [GitHub environment/OIDC guidance](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws), [OIDC claim definitions](https://docs.github.com/en/actions/reference/security/oidc)

- **Verify the subject format instead of assuming “default” means legacy.** Since July 15, 2026, new repositories and qualifying renames/transfers use subjects incorporating immutable owner/repository IDs; existing repositories can opt in. Match the actual format before rollout. **Vendor documentation.** [GitHub immutable-subject announcement](https://github.blog/changelog/2026-04-23-immutable-subject-claims-for-github-actions-oidc-tokens/)

- **Preserve fork isolation.** Fork PRs ordinarily lack repository secrets and receive restricted token permissions. Grant `id-token: write` only to jobs needing it, preserve the existing same-repository screenshot guard, and test fork behavior explicitly. Do not switch to privileged `pull_request_target` execution of PR code just to obtain credentials. **Vendor recommendation.** [GitHub fork permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [untrusted-checkout guidance](https://docs.github.com/en/actions/reference/security/secure-use)

- **Do not broaden secret access during migration.** Prefer named `GetParameter`/`GetParameters` permissions for the small required sets. `GetParametersByPath` authorizes the requested ancestor path, so individual descendant denies do not reliably constrain that query. Mask fetched values before use. **Vendor recommendation.** [AWS parameter authorization](https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-a-parameter.html), [GitHub masking guidance](https://docs.github.com/en/actions/reference/security/secure-use)

- **Make the copy and rollback procedures real.** GitHub’s secrets API cannot return stored secret values; use the original source or a tightly controlled migration workflow. Keep plaintext out of Terraform’s ordinary state: `sensitive` only redacts display, although newer Terraform supports provider-dependent write-only arguments. A workflow revert restores old authentication only while old credentials remain valid; it does not undo applied IAM changes or deployment side effects. **Vendor documentation plus rollout assessment.** [GitHub secrets API](https://docs.github.com/en/rest/actions/secrets), [HashiCorp sensitive-data handling](https://developer.hashicorp.com/terraform/language/manage-sensitive-data), [AWS rollback guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/ops_dev_integ_freq_sm_rev_chg.html)
