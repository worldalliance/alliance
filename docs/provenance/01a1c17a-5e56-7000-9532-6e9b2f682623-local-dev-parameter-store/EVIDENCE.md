# Evidence

Six research subagents, checked 2026-11-09. Each section holds the question as briefed and the report as returned; each report labels its findings as formal standard, vendor recommendation, research-backed practice or common practice. Comparisons with the options are agent judgement.

## Developer and agent access across environments

### Question

Permission boundaries for developer and AI-agent access to secrets across environments.

A person's everyday Identity Center login is what the wrapper uses, and AI coding agents run under that same login on the laptop. A team decision says every member may read every environment's secrets. Options under consideration:
a. Two permission sets, both assigned to every member: one for `dev` used day to day, and a separate one for `staging`/`prod`.
b. One permission set that reads all environments.
c. Members get `dev` only; admins get `staging`/`prod`.

Questions: What do AWS guidance (Identity Center permission sets, multi-account strategy, least privilege, Well-Architected), NIST (e.g. SP 800-53 AC-6, separation of environments), CIS, OWASP Secrets Management, and SOC 2 expectations say about developer access to production secrets? Is there guidance specific to AI coding agents or other automated tools acting under a human's credentials? Is one AWS account holding all environments itself a departure, and does that change the answer?

### Report

#### 1. Answer

No standard covers this exact case. Guidance agrees on direction: separate production from development, and keep human production access tied to a task rather than standing. Only AWS says this about developers specifically. NIST, CIS and SOC 2 state principles without banning developers from reading production secrets. For agents under a human login there is no finished standard, only recent vendor guidance favouring a dedicated, narrower credential.

#### 2. Findings

**Formal standard**
- SP 800-53: AC-6 least privilege is in the Moderate and High baselines [5]. CM-5(5), limiting production change privileges, is in none [6]. CM-4(1) accepts "physically or logically" separate test environments, High only [7]. None address reading secrets.
- SSDF PO.5.1: separate each environment, with MFA and conditional access per environment [8].
- CIS 16.8: separate production from non-production, IG2/3; nothing on developers and secrets [9]. No environment-separation control appears in AWS's CIS Benchmark listing [10].
- SOC 2 CC6.3: consider "least privilege and segregation of duties"; it names no specific control [11].
- NCCoE draft concept paper only poses questions, including "on behalf of" delegation [12].

**Vendor recommendation**
- AWS: account-level separation is "strongly recommended" (risk High) [1]. Developers get production "only for the duration of those tasks" (risk High) [2]. Also: "Do not create more accounts than are feasible to operationally manage" [3].
- AWS on agents: "a dedicated, scoped-down credential rather than the developer's own" [13]. Shell tools can bypass MCP entirely [14].
- Microsoft: a dedicated agent principal [15].
- Anthropic: avoid mounting `~/.aws` [16]. Its sandbox is off by default, and credential files stay readable unless denied [17].
- Identity Center: the token reaches "AWS accounts and applications assigned to a user" [18]. I found no scope narrower than "accounts and permission sets" [19].
- `aws/ssm` grants Decrypt to all account principals; a customer managed key makes `kms:Decrypt` restrictable [20].

**Common practice (community guidance)**
- OWASP: "engineers should not have access to all secrets," and limit human interaction with them [21].
- TEAM (AWS sample) removes the assignment on expiry, "preventing the requester from being able to invoke sessions" [22].
- NCCoE commenters describe "the common pattern of giving agents user or even local admin rights" [23].

#### 3. Options

Agent judgement, based on the findings above.

- **(a)** Prevents wrong-environment accidents and matches AWS's "most restrictive permission set" advice [4]. It is not an agent boundary: any process that can read `~/.aws/sso/cache` could likely get staging/prod credentials. Access also stays standing, against [2].
- **(b)** Weakest. It conflicts with [2], [13] and [21], and gains only convenience over (a).
- **(c)** Closest to [2] and [21] for members, but it contradicts the team decision, no source requires it, and admins' agents stay exposed.
- **Better:** every member stays eligible, but only `dev` is assigned permanently. Staging/prod come through a time-bound assignment [22] or a separate Identity Center user, with a customer managed key per environment. This honours the team decision. The agent is exposed only during the window, unless the human works with agents stopped.

**One account:** this departs from AWS's recommendation [1][2], but not from the NIST CM-4(1) text, which allows logical separation. It raises the stakes: IAM and KMS policy become the only boundary, so path restrictions need per-environment keys [20]. A separate production account would not fix the token problem, because the token covers every assigned account [18].

#### 4. Not verified

- Token reach is inferred from docs and untested; no page states it outright.
- AICPA text is login-gated; CC6.3 comes from secondary sites, CC5.1/CC8.1 not found.
- OWASP's "separate production and development" advice appeared only in a search excerpt and model summary. OWASP's ASI03 page returned 403.
- 800-53 text comes from csf.tools, not NIST.
- Later sections of [13] and [14] were truncated.
- TEAM's support status isn't stated.
- Per-permission-set MFA is unconfirmed; that page returned only its title.
- I found nothing specific to staging.

#### Sources

1. [SEC01-BP01](https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_securely_operate_multi_accounts.html): recommendation, risk, anti-patterns
2. [SEC03-BP02](https://docs.aws.amazon.com/wellarchitected/latest/framework/sec_permissions_least_privileges.html): developer production access
3. [Multi-account governance](https://docs.aws.amazon.com/wellarchitected/latest/management-and-governance-guide/manage-and-govern-with-a-multi-account-point-of-view.html): account-count caution
4. [Permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsets.html): multiple assignments
5. [AC-6, csf.tools](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-6/): statement, baselines
6. [CM-5(5), csf.tools](https://csf.tools/reference/nist-sp-800-53/r5/cm/cm-5/cm-5-5/): statement, baselines
7. [CM-4(1), csf.tools](https://csf.tools/reference/nist-sp-800-53/r5/cm/cm-4/cm-4-1/): statement, discussion
8. [SP 800-218](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-218.pdf): PO.5.1 table, p. 8
9. [CIS 16.8](https://controls-assessment-specification.readthedocs.io/en/latest/control-16/control-16.8.html): v8 assessment text
10. [Security Hub CIS listing](https://docs.aws.amazon.com/securityhub/latest/userguide/cis-aws-foundations-benchmark.html): control titles
11. [KirkpatrickPrice](https://kirkpatrickprice.com/tag/soc-2-academy/page/7/) and [Cloudaware](https://ce.prod.cloudaware.com/frameworks/soc-2/cc6/03/): CC6.3 as quoted
12. [NCCoE paper](https://www.nccoe.nist.gov/sites/default/files/2026-02/accelerating-the-adoption-of-software-and-ai-agent-identity-and-authorization-concept-paper.pdf): pp. 1–7
13. [AWS coding-agent controls](https://aws.amazon.com/blogs/security/balancing-speed-and-safety-a-control-framework-for-ai-coding-agents/): truncated
14. [AWS MCP patterns](https://aws.amazon.com/blogs/security/secure-ai-agent-access-patterns-to-aws-resources-using-model-context-protocol/): truncated
15. [Microsoft](https://www.microsoft.com/en-us/security/blog/2026/07/16/least-privilege-for-ai-agents-identity-access-and-tool-binding/): full article
16. [Secure deployment](https://code.claude.com/docs/en/agent-sdk/secure-deployment): credentials section
17. [Sandboxing](https://code.claude.com/docs/en/sandboxing): defaults, part verbatim
18. [CreateToken](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_CreateToken.html): token description
19. [OAuth scopes](https://docs.aws.amazon.com/singlesignon/latest/userguide/customermanagedapps-saml2-oauth2.html): scope table
20. [SecureString decryption](https://docs.aws.amazon.com/systems-manager/latest/userguide/ps-restrict-decryption.md): key behaviour
21. [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): first half verbatim
22. [TEAM architecture](https://aws-samples.github.io/iam-identity-center-team/docs/overview/architecture.html): grant/revoke flow
23. [NCCoE comments](https://pages.nist.gov/nccoe-ai-identity/summary-of-comments.html): part verbatim

## Which commands a secrets wrapper covers

### Question

Which commands a local secrets-injecting wrapper should cover.

Repo context: `scripts/with-env.sh` already wraps the root dev scripts in `package.json` (including `frontend:dev`, which needs no secrets) to export per-worktree ports and database names. `scripts/secrets_run.sh` is the deployed-server equivalent. Options under consideration:
a. A separate `scripts/with-secrets.sh`, used only by commands that need secrets (server dev, repl, database migrations). Commands with no secrets work without an AWS login.
b. Extend `with-env.sh` so every wrapped command fetches secrets. One entry point, but an expired login blocks commands that need no secrets.

Questions: How do established tools handle this: `aws-vault exec`, `chamber exec`, `doppler run`, `infisical run`, `op run` (1Password), `dotenvx run`, `direnv`, `sops exec-env`? What do their docs recommend for scoping which commands receive secrets? What do OWASP and the twelve-factor app say about exposing secrets in process environments and limiting which processes get them? Is fetching on each command, versus caching, part of the standard pattern, and what do they do on expired credentials?

### Report

**1. Answer**

There is no formal standard for which local commands get secrets. No tool or standards body I read prescribes it. The common design is an explicit per-command wrapper that injects into one child process and does not run the command if the fetch fails. Option (a) matches that design. Caching is split between tools.

**2. Findings**

- **Vendor recommendation:** Injection is per invocation in `chamber exec`, `doppler run`, `op run`, `sops exec-env` and `aws-vault exec`. Infisical matched, but only in a summary of its docs. None says which commands to wrap. [S1–S6]
- **Vendor recommendation:** Doppler warns that with shell-wide export "every process executed in your shell will now have access". chamber's README gives the same warning about `chamber env`. [S2, S4]
- **Vendor recommendation:** 1Password says to assume same-user processes can read each other's environment. AWS calls child-process injection for AI agents "best-effort... not a security boundary". [S5, S9]
- **Common practice:** direnv is the exception, exporting to the whole shell per directory. Its `strict_env` is opt-in. [S7]
- **Formal standard (closest available):** CWE-526 lists child-process exposure, and its mitigation is removing variables that aren't needed. CWE is a weakness catalogue, not a rule about wrappers. [S10]
- **Vendor recommendation (community guidance, no better category):** OWASP says least privilege applies, and that secrets should "never be retrievable by everyone and everything". It discourages environment variables, but in its container section. It gives no local-development scoping or caching guidance. [S11]
- **Twelve-factor** (methodology, nearest category common practice): it stores credentials in environment variables and does not address exposure or per-process limits. [S12]
- **Common practice, fetching:** chamber fetches on each run in `exec.go`, with no cache in that file. aws-vault caches AWS sessions, not application secrets. `op` caches encrypted items. Doppler and Infisical keep encrypted snapshots for outages, and Doppler can bypass its snapshot with `--no-fallback`. [S1–S3, S5, S13]
- **Common practice, failure:** Code reading shows aws-vault, chamber and sops return before running the command. Infisical serves its snapshot with a warning when disconnected, and tries re-login when connected. `op` prompts. [S1, S3, S5, S6]
- **Vendor recommendation (AWS):** An expired login must be renewed with `aws sso login`. Parameter Store defaults to 40 TPS shared across its get APIs, and SecureStrings may also hit KMS limits. [S8]

**3. Options** (agent judgement, from the findings above)

- **(a) Best fit.** It gives only the named commands secrets, and `frontend:dev` keeps working on an expired login. It should run inside `with-env.sh`, not replace it, so ports and secrets stay separate concerns.
- **(b) Not supported.** It resembles direnv's breadth, giving every wrapped command, including `frontend:dev`, secrets it doesn't need. That is the CWE-526 exposure. An expired login would also block unrelated work.
- **Refinement to (a):** Scope by consumer, as `chamber exec <service>` does, passing `server` to fetch only `/alliance/dev/server/`.
- **Caching:** Fetch at each start, keep no snapshot, and exit non-zero before running the command, with the `aws sso login` command in the error. Snapshots serve outage resilience, which conflicts with failing loudly. Fetching per start should fit 40 TPS for ten people, but simultaneous agents could throttle, so add retries.
- **Repo note:** `migration:*` and `repl` live in `server/package.json` and have no root `with-env` wrapper, so (a) must cover those entry points. `repl` also preloads `dotenv/config`.

**4. Not verified**

- Doppler's behaviour on an expired login or API failure, which sits in a package I did not read.
- The exact AWS expired-token error text.
- Non-interactive `op` behaviour, which matters for agents.
- Infisical's `HandleError` exit and `run` docs. The `run` details came from summary text and source.
- Whether chamber caches outside `exec.go`.
- Most pages were read through a fetch agent. I checked the OWASP wording directly against its source.
- aws-vault's README says the project is abandoned, pointing to the ByteNess fork, which I did not read.

**Sources** (what was read)

- S1 [aws-vault USAGE](https://github.com/99designs/aws-vault/blob/master/USAGE.md), [README](https://raw.githubusercontent.com/99designs/aws-vault/master/README.md), [exec.go](https://raw.githubusercontent.com/99designs/aws-vault/master/cli/exec.go): exec, sessions, failure path
- S2 [chamber README](https://github.com/segmentio/chamber), [exec.go](https://raw.githubusercontent.com/segmentio/chamber/master/cmd/exec.go): exec, strict flags, errors
- S3 [Infisical reference](https://infisical.com/docs/cli/reference-agents), [run.go](https://raw.githubusercontent.com/Infisical/cli/main/packages/cmd/run.go), [secrets.go](https://raw.githubusercontent.com/Infisical/cli/main/packages/util/secrets.go): run, backup
- S4 [Doppler CLI](https://docs.doppler.com/docs/cli), [accessing secrets](https://docs.doppler.com/docs/accessing-secrets), [fallbacks](https://docs.doppler.com/docs/automatic-fallbacks): scoping, warning, snapshot
- S5 [op run](https://www.1password.dev/cli/reference/commands/run/), [environment variables](https://www.1password.dev/cli/secrets-environment-variables/), [CLI reference](https://www.1password.dev/cli/reference/), [app integration](https://www.1password.dev/cli/app-integration/), [security](https://www.1password.dev/cli/app-integration-security.md): scope, cache, expiry
- S6 [sops advanced](https://getsops.io/docs/usage/advanced/), [main.go](https://raw.githubusercontent.com/getsops/sops/main/cmd/sops/main.go): exec commands, decrypt failure
- S7 [direnv](https://direnv.net/), [stdlib](https://direnv.net/man/direnv-stdlib.1.html), [toml](https://direnv.net/man/direnv.toml.1.html): shell scope, strict mode
- S8 [AWS CLI SSO](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html), [session duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html), [throughput](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-throughput.html), [quotas](https://docs.aws.amazon.com/general/latest/gr/ssm.html): login, limits
- S9 [AWS, AI agents](https://docs.aws.amazon.com/secretsmanager/latest/userguide/retrieving-secrets-ai-agents.html): `asm-exec`, boundary statement
- S10 [CWE-526](https://cwe.mitre.org/data/definitions/526.html): consequences, mitigations
- S11 [OWASP cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), [source](https://raw.githubusercontent.com/OWASP/CheatSheetSeries/master/cheatsheets/Secrets_Management_Cheat_Sheet.md): sections 2, 5.1, 6.3
- S12 [Twelve-factor config](https://12factor.net/config), [admin processes](https://12factor.net/admin-processes)
- S13 [Doppler run.go](https://raw.githubusercontent.com/DopplerHQ/cli/master/pkg/cmd/run.go): fallback and cache flags

## Shared developer-tool credentials and a background upload hook

### Question

Where shared developer-tool credentials belong, when a background hook depends on them.

Repo context: a gitignored `.env.devtools` holds shared Linear OAuth client credentials and long-lived AWS keys for a private bucket that receives AI coding session transcripts (`agents/chats/chats.ts`, `agents/README.md`). A hook uploads the transcript in every agent session. If these move behind the Identity Center login, an expired login stops uploads until someone logs in again. Options under consideration:
a. Move both to `/alliance/dev/devtools/` in Parameter Store and have the upload hook warn loudly when the login has expired.
b. Leave `.env.devtools` alone for now, so uploads never depend on a login, but a hand-copied secrets file remains.

Questions: What do OWASP, AWS (long-term access keys versus temporary credentials), and vendor docs say about shared long-lived credentials kept in plaintext files on developer machines? For the bucket specifically, is the standard to use a stored key at all, or the person's own temporary credentials directly? How do telemetry or upload agents usually handle credential expiry (spool and retry later, fail and warn, drop)? How long can Identity Center sessions be configured to last, and what is AWS's recommended setting? Are there better options than the two listed?

### Report

**1. Answer**

For AWS access there is a clear vendor standard: people use temporary federated credentials, not a stored shared key. The bucket should therefore use each person's own Identity Center credentials. No formal standard covers secrets files on laptops, and no source I read addresses a background uploader whose login expires, so practice there is split. Neither listed option matches these findings.

**2. Findings**

OWASP is non-profit guidance, so "vendor" is the closest label. I did not search for research-backed studies.

- **Vendor (AWS):** "Require your human users to use temporary credentials" [1]. Well-Architected rates omitting this High risk and names sharing long-term keys an anti-pattern. Restricted keys are for cases where temporary credentials aren't supported [2].
- **Vendor (OWASP):** Expire and rotate secrets, and prefer dynamic ones [3]. Plaintext config files are a leak path [4], and shared team tokens lose accountability [5].
- **Vendor (Linear):** Client credentials are server-to-server, last 30 days and have no refresh. Per-user OAuth is for individual authentication [6].
- **Vendor (AWS sessions):** Interactive sessions default to 8 hours, range 15 minutes to 90 days [7]. Permission sets default to 1 hour, maximum 12, and shouldn't be "longer than is needed" [8]. AWS recommends no number for either. The CLI refreshes automatically until the refresh token expires, and logging in again needs a person [9].
- **Formal (NIST 800-63B-4, US federal scope):** Overall reauthentication SHOULD be within 24 hours at AAL2 and 30 days at AAL1 [10].
- **Vendor (OTLP):** Only 429, 502, 503 and 504 are retried. Other 4xx/5xx data MUST be dropped and SHOULD be counted [11].
- **Common practice:** OTel Collector, Fluent Bit and Datadog queue and retry within limits, then drop [12][13][14]. Sentry's default transport drops [15].

**3. Options**

- **a:** Fits Linear, but for the bucket it only relocates a shared long-term key. Its warning also has a gap: `check` runs only at session start and tests only that keys exist, and Claude's per-turn upload failures show nothing (`agents/README.md:25`). Mid-session expiry would stay silent.
- **b:** Keeps the anti-pattern. The IAM user is narrowly scoped with no delete (`docs/provenance/01a19e0b-aa3d-7000-8fcd-136f2b217cd7-agent-chat-archive/DECISIONS.md:9`), so it is tolerable only as an interim step. It was chosen partly because the account didn't run Identity Center (`docs/provenance/01a19e0b-aa3d-7000-8fcd-136f2b217cd7-agent-chat-archive/DECISIONS.md:8`), which is no longer true.
- **Better (agent judgement), split by credential:**
  - Delete the IAM user, grant bucket access through a scoped permission set, and have the hook call `aws configure export-credentials` [16].
  - Move Linear to Parameter Store.
  - On expiry, record the pending transcript, warn at the next hook and session start, and retry after login. Uploads are whole-file (`chats.ts:97`), so the local transcript is already the spool.
  - Keep the 8-hour default, or at most 24 hours per NIST; retrying removes the need for long sessions.
- **Rejected (agent judgement):** Presigned uploads need a signing service [17]. Roles Anywhere needs X.509 PKI and targets workloads [18].
- **Not in the options:** `.env.devtools` also holds `POSTHOG_API_KEY` (`agents/skills/posthog/SKILL.md:8`), which needs the same decision.

**4. Could not verify**

- Pages were read through a fetching subagent. The later parts of [3] and NIST §5.2 came back only as summaries, so "no laptop passage" in [3] is partly summary-based.
- Whether OTel or Fluent Bit implementations follow OTLP on auth errors; their docs don't say.
- Whether Identity Center has an inactivity timeout for CLI sessions, and the CLI's exact expiry error.
- Whether `export-credentials` fits Codex's 3-second `SessionEnd` limit, and whether Bun's `sessionToken` option works with these credentials. Both are untested.
- Vector's page returned 404, and AWS's access-key best-practices page returned no content.

**Sources** (what was read)

1. [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html): temporary credentials, key exceptions
2. [SEC02-BP02](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_unique.html): risk level, anti-patterns
3. [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): sections 1–2.7.4 verbatim
4. [NHI2](https://owasp.github.io/www-project-non-human-identities-top-10/2025/2-secret-leakage/): leak paths
5. [NHI10](https://owasp.github.io/www-project-non-human-identities-top-10/2025/10-human-use-of-nhi/): shared tokens
6. [Linear OAuth](https://linear.app/developers/oauth-2-0-authentication): grants, lifetimes
7. [Interactive sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-interactive-sessions.html): duration limits
8. [Permission set duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html): limits, best practice
9. [CLI SSO concepts](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso-concepts.html) and [CLI SSO setup](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html): refresh, login
10. [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): section 2 reauthentication limits
11. [OTLP spec](https://opentelemetry.io/docs/specs/otlp/): retry and drop rules
12. [OTel resiliency](https://opentelemetry.io/docs/collector/resiliency/): queueing, retries
13. [Fluent Bit retries](https://docs.fluentbit.io/manual/administration/scheduling-and-retries): retry limits, discard
14. [Datadog network](https://docs.datadoghq.com/agent/configuration/network/): buffering limits
15. [Sentry transports](https://docs.sentry.io/platforms/javascript/guides/electron/configuration/transports/): default drop, offline transport
16. [export-credentials](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html): output formats
17. [Presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html): signer limits, lifetime
18. [Roles Anywhere](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html): requirements, audience

## How a local backend authenticates to AWS

### Question

How a locally running backend should authenticate to AWS in development.

Repo context: the NestJS server uses the AWS SDK's default credential chain (no explicit credentials in `server/src`). Locally, `server/.env` holds the access keys of an IAM user `alliance-dev` (see `terraform/iam-dev.tf`), scoped to S3 on the assets buckets. The keys aren't declared in the server's config schema (`server/src/config/env.ts`). Options under consideration:
a. Copy the IAM user's keys into `/alliance/dev/` and declare them in the schema. S3 behaves as today and a running dev server survives a login expiry, but the long-lived key stays.
b. Remove the keys and use each person's Identity Center login, with S3 access added to the permission set. No long-lived key, but S3 calls start failing when a login expires mid-run.

Questions: What do AWS's IAM best practices, the AWS SDK credential-provider docs, and the Identity Center docs say about long-term IAM user keys for local development? How does the SDK refresh SSO credentials in a long-running process, and what happens at expiry? Do secret-injecting tools (`aws-vault` credential server, for example) offer a recognised solution for long-running local processes? Note that static `AWS_ACCESS_KEY_ID` in a process's environment outranks a profile for everything that process spawns; research whether that matters and what's recommended. Are there better options than the two listed?

### Report

#### 1. Answer

**The principle has a vendor-level standard:** people use temporary credentials, and AWS labels IAM-user keys "(Not recommended)". I found no formal standard, but I didn't check NIST or CIS. **Surviving a login expiry has no standard.** AWS's answer is refreshable SSO configuration plus logging in again.

#### 2. Findings

**Vendor recommendation**
- "Require your human users to use temporary credentials." Long-term keys are for workloads that can't use roles and for tools without Identity Center support [1].
- Long-term keys are "(Not recommended)" [2].
- "Developers using long-term access keys" is a high-risk anti-pattern [3].
- Security Hub IAM.3 flags keys older than 90 days [4].
- The JS SDK guide recommends short-term credentials [5].
- Long-running processes should use the SSO token provider configuration. The legacy configuration is fixed at eight hours [6].
- When the portal session ends, existing clients work until their role session ends, and new clients fail immediately [7].
- Portal sessions default to 8 hours, maximum 90 days [8]. Permission sets last 1–12 hours [9].

**Vendor, from installed SDK source (3.972.29), not docs [13]**
- **Your precedence premise is only partly right for this SDK.** If `AWS_PROFILE` is set, `fromEnv` is skipped and the profile wins. The SDK warns that this "may change" and says to set only one.
- Without `AWS_PROFILE`, static keys win. The CLI docs rank environment variables above profiles without ordering the two [10].
- Static keys are inherited by every child process, so the wrapper shouldn't set both.
- The SDK refreshes in the last 5 minutes. At expiry it fails with `Token is expired… run 'aws sso login'` and doesn't fall through to other providers.
- The token file is re-read on each resolution, so logging in should recover a running server without a restart.
- **Crash risk:** I ran the SDK's `memoizeChain` with a synthetic failing provider. A failed background refresh in that 5-minute window was an unhandled rejection, and Node exited 1. `server/src` has no `unhandledRejection` handler, so the dev server may exit rather than only fail S3 calls.

**Common practice**
- `aws-vault --ecs-server` serves refreshing credentials on an ephemeral port with a token [11]. Upstream is abandoned; a maintained fork exists [11][12].
- That's one tool, not an established norm.

#### 3. Options (agent judgement)

**a. Keys in `/alliance/dev/`:** contradicts [1][2][3], and only its expiry survival is a real advantage. It's also worse than it looks: `terraform/iam-dev.tf` grants write and delete on the bucket tagged `prod`, and every agent process would receive that key.

**b. Identity Center login:** matches the guidance, and failures are loud. Recommended, with these additions:
- Use `sso_session` profiles.
- Lengthen the portal session, up to 90 days; a 12-hour permission set adds to that [6][14].
- Have the wrapper set `AWS_PROFILE` and refuse to run if static `AWS_*` keys are present.
- Grant only the dev bucket, unless local work really needs prod.
- Decide how to handle the crash path.

**Other options:**
- **Credential server:** adds a moving part without removing expiry, because it still depends on the login. The SDK already refreshes.
- **`aws login`:** explicitly not for Identity Center users [15].
- **Roles Anywhere:** needs X.509 certificates and targets workloads [16].
- **A local S3 emulator:** would remove AWS from the path, but I didn't research it.

#### 4. Could not verify

- A real end-to-end session expiry; I only tested `memoizeChain` in isolation.
- Whether several worktree processes refreshing the same SSO token cache conflict.
- `aws-vault` behaviour at session end, and how recently the fork was active.
- Whether Granted serves long-running processes.
- Whether an environment-only `AWS_PROFILE` loses to static keys in botocore; the code suggests so, but that's my inference.
- Whether local development needs the prod bucket.

#### Sources

Pages were read through a fetch agent.

1. [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html): full page
2. [Programmatic access](https://docs.aws.amazon.com/IAM/latest/UserGuide/security-creds-programmatic-access.html): full page
3. [SEC02-BP02](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/sec_identities_unique.html): full page
4. [Security Hub IAM controls](https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html): IAM.3 text, page partly truncated
5. [JS SDK credentials](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html): recommendation and chain table
6. [SSO credential provider](https://docs.aws.amazon.com/sdkref/latest/guide/feature-sso-credentials.html): configuration and long-running guidance
7. [Understanding SSO](https://docs.aws.amazon.com/sdkref/latest/guide/understanding-sso.html): refresh and expiry
8. [User interactive sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-interactive-sessions.html): durations
9. [Permission set duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html): limits
10. [CLI authentication](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-authentication.html): precedence list
11. [aws-vault](https://github.com/99designs/aws-vault) and [USAGE.md](https://github.com/99designs/aws-vault/blob/master/USAGE.md): status and server modes
12. [ByteNess fork](https://github.com/ByteNess/aws-vault): README
13. Installed code under `node_modules/`: `@aws-sdk/credential-provider-node` (`defaultProvider.js`, `runtime/memoize-chain.js`), `@aws-sdk/token-providers/dist-es/fromSso.js`, `@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js`
14. [Session duration considerations](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-session-duration-prereqs-considerations.html): 20-hour plus 12-hour example
15. [`aws login`](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html): audience
16. [Roles Anywhere](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/introduction.html): introduction

## Rolling out a change in where local secrets come from

### Question

How to roll out a change in where developers' local secrets come from.

Repo context: every checkout has hand-made `.env` files, and `scripts/new-worktree.sh` copies them into new worktrees. Env vars injected by the wrapper outrank `.env` values. The team's own rule is expand-migrate-contract for breaking changes, with an explicit marker on temporary fallbacks. Options under consideration:
a. Two PRs: add the wrapper while `.env` secrets keep working as a marked fallback, then remove them once everyone has logged in.
b. One PR that switches everyone at once.

Questions: Is there established guidance on migrating teams between secret stores or developer-environment setups (vendor migration guides such as Doppler, Infisical, 1Password, HashiCorp Vault; expand-contract and parallel-change writing such as Martin Fowler's; DORA research on small batches)? How do teams handle the risk that a silent fallback hides a broken new path, and how do they decide when the old path can be removed? What should happen to the plaintext secrets left in the old files, including whether they need rotating after the move?

### Report

#### 1. Answer

There is no industry standard for this specific migration. No source I read prescribes how a team should move laptop secrets between stores. Adjacent guidance favours option (a)'s shape, but not a silent fallback. For rotation, the trigger is exposure, not the move.

#### 2. Findings

- **Common practice:** Parallel Change says contract follows full migration. The migrate phase "can be short", and skipping contract can leave you "worse" off [1].
- **Research-backed practice:** DORA finds small batches predict delivery performance, but the page doesn't cover migrations or developer tooling [2]. It is weak support here.
- **Vendor recommendation:** Doppler orders login, setup, run, then removing `.env` files and the code relying on them [3]. 1Password says delete the file and lists rotation as "optional" [4]. HashiCorp says pilot on a non-critical application [5]. None covers team phasing or fallback.
- **Vendor recommendation:** AWS warns that fallback hides latent bugs, and says an essential fallback must run continuously [6]. This concerns distributed systems, so it applies only by analogy.
- **Common practice, removal:**
  - Stripe compared both paths, raised errors on mismatch, made the old accessor raise, and gated removal on evidence [7].
  - Google says warnings alone rarely work; compulsory deprecation needs enforcement, usage logging and planned outages [8].
  - Feature Toggles describes expiry dates and "time bombs" [9].
- **Common practice (OWASP, not a formal standard):** Exposed keys need immediate revocation and removal. It says nothing about rotating on migration, or about `.env` files [10].
- **Vendor recommendation:** GitHub says rotate committed secrets first; a history rewrite "may not be warranted" [11].
- **Vendor recommendation (agency advisory, incident-specific):** CISA described malware that scanned developer environments for credentials, and said "Immediately rotate all developer credentials" [12].
- **Vendor recommendation:** CloudTrail captures all Systems Manager API calls, with 90 days of Event history [13].

#### 3. Options

**(a) Two PRs:** This is the best fit, and matches your expand-migrate-contract rule, but only if the fallback is loud. As described, it has a hole: wrapper values outrank `.env`, so a key missing from Parameter Store silently resolves from `.env`, hiding the broken path.

**(b) One PR:** Defensible at ten people, and fails loudly. But every login, IAM or missing-key failure lands at once across all laptops, worktrees and agents, and it breaks your own rule.

**Better option, (a) amended (agent judgement, drawing on [6–9]):**
- The wrapper exits non-zero on a failed login, failed fetch or missing required key.
- `.env` secrets apply only behind an explicit flag, and each key used from `.env` is printed. Mark this `BACKCOMPAT` with a removal date.
- Remove it once each person's principal appears in CloudTrail and has completed a run with the fallback off. Enforce the date with a time bomb.
- The contract PR also stops `new-worktree.sh` copying secrets (`scripts/new-worktree.sh:317`) and scrubs existing worktrees. Strip keys rather than delete files, because `server/.env` also holds worktree overrides (`scripts/new-worktree.sh:402-406`).

**Old plaintext (agent judgement, drawing on [10–12]):**
- Moving a secret doesn't itself require rotation.
- Rotate shared secrets where exposure can't be excluded: former holders, unknown copies, anything pasted or committed. Prioritise production-valued and high-privilege credentials.
- Rotate after contract, so leftover copies stop working and any remaining dependency fails visibly.

#### 4. Could not verify

- Any published case study of a team doing this rollout.
- Doppler's `.env` cleanup post returned 404.
- Whether vendor CLIs fall back silently; the docs I read don't say.
- That `GetParameters` is logged. The AWS page says "all API calls" but doesn't name it, so run one test first.
- Whether plain deletion counts as sanitization under NIST SP 800-88; I read only the glossary and landing page.
- Whether current `.env` files hold production credentials, and whether `.env.production`/`.env.staging` files deleted from git history held secrets. I checked file names only, and those files are worth auditing.

#### Sources

1. [Parallel Change](https://www.martinfowler.com/bliki/ParallelChange.html): full page.
2. [DORA small batches](https://dora.dev/capabilities/working-in-small-batches/): full page; underlying reports not opened.
3. [Doppler CLI](https://docs.doppler.com/docs/install-cli): local development and `.env` removal sections.
4. [1Password migration](https://1password.com/blog/env-file-migration-secure-programming-best-practices): full post.
5. [HashiCorp adoption](https://www.hashicorp.com/blog/5-steps-to-set-up-vault-for-widespread-adoption-at-your-org): full post.
6. [AWS, avoiding fallback](https://aws.amazon.com/builders-library/avoiding-fallback-in-distributed-systems/): full article.
7. [Stripe online migrations](https://stripe.com/blog/online-migrations): full post.
8. [Software Engineering at Google, ch. 15](https://abseil.io/resources/swe-book/html/ch15.html): full chapter.
9. [Feature Toggles](https://martinfowler.com/articles/feature-toggles.html): full article.
10. [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): full page.
11. [GitHub, removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository): full page.
12. [CISA npm alert](https://www.cisa.gov/news-events/alerts/2025/09/23/widespread-supply-chain-compromise-impacting-npm-ecosystem): full alert.
13. [Systems Manager CloudTrail logging](https://docs.aws.amazon.com/systems-manager/latest/userguide/monitoring-cloudtrail-logs.html): full page.

## Smaller wrapper design points

### Question

Seven smaller design points for the same local-secrets wrapper. For each one, say what the standard is, or that there is none.

1. Only secrets go in the store, never per-checkout settings like database names or URLs. Repo context: an injected value would override each worktree's own value, and could point an end-to-end test suite that drops its schema at the wrong database.
2. The wrapper refuses to override a variable that is already set, and fails with a clear message on an expired login. Compare with `doppler run`, `infisical run`, `chamber exec`, `op run`, and `dotenv` precedence rules.
3. Tests run on committed fake values, with no AWS access. See `server/.env.test`.
4. Per-person values, such as a personal PostHog API key, stay local and out of the shared store.
5. A CI drift check compares Parameter Store names against the app's config schemas, using only `ssm:DescribeParameters` (names, no decryption), failing on a missing required key or an undeclared extra. Is this a recognised pattern? Check whether DescribeParameters needs care, such as its pagination or that it isn't scoped by path the way GetParametersByPath is.
6. Identity Center permission sets and assignments are managed in Terraform. Check the AWS and Terraform provider docs, including what permissions and which account the Terraform runner needs.
7. Cloudflare Turnstile site keys are committed to the open-source repo as config rather than stored as secrets. Check Cloudflare's docs on site keys versus secret keys.

### Report

**1. Answer**

No formal standard or published research covers any of the seven points. Vendor documentation settles 6, 7 and the API facts in 5. Points 1, 2 and 4 are split, 3 is a firm framework convention, and 5 is a homemade pattern.

**2. Findings** (V = vendor recommendation, C = common practice)

1. Kubernetes separates non-confidential from confidential data (V [1]). Twelve-Factor treats both as config (C [2]). Django prefixes test database names with `test_` (V [3]).
2. Injected value wins: `op run` (V [4]), Doppler unless `--preserve-env` (C [5]), Infisical (C [6]), chamber with a warning (C [7]). Existing value wins silently: dotenv (C [8]), Vite, Next.js, Symfony (V [9][10][11]). None errors on collision. Expired Identity Center sessions need explicit re-login (V [12]); botocore's error names the fix (C [13]).
3. Next.js and Symfony commit `.env.test` and skip `.env.local` under test (V [10][11]). Cloudflare publishes dummy test keys (V [14]).
4. PostHog personal keys are tied to one account and never committed (V [15]). In-store per-person values: Doppler, Infisical, Vault (V [16][17][18]). Local: `.env.local` (V [9][10][11]).
5. File-based name comparison exists: dotenv-safe checks missing keys, dotenv-linter both directions (C [19][20]). Against a live store I found only one vendor's promotional post [21], which doesn't count. DescribeParameters returns at most 50 per page, possibly zero with a `NextToken`, and no values (V [22]). Path filter takes Recursive or OneLevel (V [23]). No resource-level IAM (V [24]). 3 TPS default (V [25]).
6. Terraform covers this (V [26]). Account instances don't support permission sets (V [27]); organization instances live in the management account (V [28]). Delegated admins need a member account and can't alter permission sets provisioned in the management account (V [29]). Assignments there need extra IAM on `aws-reserved/sso.amazonaws.com/*` (V [30]). AWS says to keep workloads out of the management account (V [31]).
7. The site key is "a public identifier", the secret key stays private, and each environment gets its own widget (V [32]). Hostname allowlists limit reuse (V [33]).

**3. Comparison**

1. Stricter than Twelve-Factor, but nothing forbids it. It is justified here: `server/src/datasources/dataSourceTest.ts:22` falls back to `DB_NAME`, so an injected value could reach the schema-dropping suite.
2. A hard error has no precedent, but silently keeping the local value breaks fail-loud. Agent judgement: error, naming the variables, and exempt nested wrapper runs. Expiry handling matches AWS.
3. Matches.
4. One of two accepted models; local is simplest with Parameter Store (agent judgement).
5. Sound but custom. Loop until `NextToken` is absent, never stopping on an empty page. The Path filter isn't a permission boundary, so CI can list every environment's names.
6. Standard tooling, with a precondition: a standalone account must become an organization's management account (V [34]). The runner then needs management-account credentials, and delegation is unavailable. The repo has no Identity Center resources or CI apply yet.
7. Matches. The secret key belongs in the store. The repo has no Turnstile yet.

**4. Could not verify**

- Three AWS pages returned empty: Service Authorization (replaced by [24]), Parameter Store access, and the Terraform prescriptive pattern.
- The Path filter's default option; set `Recursive` explicitly.
- Kubernetes wording rests on an extracted summary.
- Your Identity Center instance type (no AWS calls made).
- Provider docs were read at `main`; the repo pins `~> 4.16`.
- The JS SDK's expiry message.

**Sources** (what was read)

1. [K8s ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/): purpose, via summary
2. [12factor config](https://12factor.net/config): config definition
3. [Django testing](https://docs.djangoproject.com/en/5.2/topics/testing/overview/): test database section
4. [op run](https://www.1password.dev/cli/reference/commands/run/): precedence list
5. [Doppler run.go](https://raw.githubusercontent.com/DopplerHQ/cli/master/pkg/cmd/run.go): `--preserve-env` flag text
6. [Infisical run.go](https://raw.githubusercontent.com/Infisical/cli/main/packages/cmd/run.go): `formatSecretsForShell`
7. [chamber exec.go](https://raw.githubusercontent.com/segmentio/chamber/master/cmd/exec.go), [environ.go](https://raw.githubusercontent.com/segmentio/chamber/master/environ/environ.go): collision handling
8. [dotenv](https://github.com/motdotla/dotenv): README override section
9. [Vite](https://vite.dev/guide/env-and-mode): priority, `.env.local`
10. [Next.js](https://nextjs.org/docs/app/guides/environment-variables): load order, `.env.test`
11. [Symfony configuration](https://symfony.com/doc/current/configuration.html), [testing](https://symfony.com/doc/current/testing.html): `.env` rules
12. [AWS CLI SSO](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html): expiry
13. [botocore exceptions](https://raw.githubusercontent.com/boto/botocore/develop/botocore/exceptions.py): SSO error text
14. [Turnstile testing](https://developers.cloudflare.com/turnstile/troubleshooting/testing/): dummy keys
15. [PostHog API](https://posthog.com/docs/api): key guidance
16. [Doppler branch configs](https://docs.doppler.com/docs/branch-configs): Personal Configs
17. [Infisical projects](https://infisical.com/docs/documentation/platform/secrets-mgmt/project): personal overrides
18. [Vault templating](https://developer.hashicorp.com/vault/tutorials/policies/policy-templating): per-user paths
19. [dotenv-safe](https://github.com/rolodato/dotenv-safe): README
20. [dotenv-linter](https://raw.githubusercontent.com/dotenv-linter/dotenv-linter/master/README.md): diff section
21. [ConfigStack post](https://dev.to/jckilous/why-we-started-failing-ci-on-configuration-drift-11f4): full post
22. [DescribeParameters](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_DescribeParameters.html): pagination, response
23. [ParameterStringFilter](https://docs.aws.amazon.com/systems-manager/latest/APIReference/API_ParameterStringFilter.html): keys, options
24. [AWS Service Reference, SSM](https://servicereference.us-east-1.amazonaws.com/v1/ssm/ssm.json): action resources
25. [Parameter Store throughput](https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-throughput.html): limits
26. [ssoadmin_permission_set](https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/ssoadmin_permission_set.html.markdown), [account_assignment](https://raw.githubusercontent.com/hashicorp/terraform-provider-aws/main/website/docs/r/ssoadmin_account_assignment.html.markdown): resource docs
27. [Account instances](https://docs.aws.amazon.com/singlesignon/latest/userguide/account-instances-identity-center.html): limitations
28. [Instance types](https://docs.aws.amazon.com/singlesignon/latest/userguide/identity-center-instances.html): comparison
29. [Delegated admin](https://docs.aws.amazon.com/singlesignon/latest/userguide/delegated-admin.html): prerequisites, limits
30. [Identity policies](https://docs.aws.amazon.com/singlesignon/latest/userguide/iam-auth-access-using-id-policies.html): example 2 and its note
31. [Management account practices](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html): workloads section
32. [Turnstile get started](https://developers.cloudflare.com/turnstile/get-started/): keys, environments
33. [Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/): allowlist
34. [Enable Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/enable-identity-center.html): standalone account path
## Where non-secret development settings live

### Question

Where a project's non-secret settings for local development should live.

Repo context: an open-source monorepo. A team decision says non-secret per-environment settings are committed as typed config, and Parameter Store holds only secrets. Staging and production values are committed in `common/src/deployed-config.ts`, but its development entry is `undefined` (line 70). The server's schema (`server/src/config/env.ts`, `setFor[NodeEnv.Development]`) requires values in development such as `MAIL_FROM`, `SMTP_HOST`, `GOOGLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_SERVICES_ID`, `APPLE_BUNDLE_ID`, `POSTHOG_KEY`, `POSTHOG_PROJECT_ID`, `PANGRAM_API_URL`. Today they exist only in hand-made, gitignored `server/.env` files, so a fresh clone can't boot once secrets move out. Per-checkout values (database names, ports, URLs) are generated by worktree tooling and are out of scope. Options under consideration:
a. Add a development entry to the committed typed config.
b. Put them in Parameter Store alongside the secrets, under the `dev` path.
c. Leave them in hand-made `.env` files.

Questions: What do vendor and framework docs recommend for development defaults: for example committed `.env`/`.env.development` conventions in Next.js, Vite, Symfony, Rails credentials and environment config, Django settings; the twelve-factor app's position on grouped environments and on committing config; `.env.example` conventions; Kubernetes ConfigMap versus Secret; OWASP Secrets Management? What do open-source projects with a small hosted deployment usually do? For each kind of value above, is it safe to publish in a public repository, according to the vendor's own documentation: Google OAuth client IDs, Apple Team ID, Key ID and Services ID, PostHog project API keys, an SMTP hostname, a sender address? Does a development value differ from a production one in that assessment? What is the usual way for an outside contributor to run a project without the team's credentials, and does that bear on the choice?

### Report

**1. Answer**

There is no formal standard, and framework practice is split on committing dev env files. Where a framework addresses shared non-secret dev defaults directly, it says commit them. Option (a) fits best, with one Google caveat (agent judgement).

**2. Findings**

- **Formal standard:** the OAuth client identifier "is not a secret" [1].
- **Vendor, commit:** Symfony commits `.env` and `.env.<environment>` holding local-development defaults [2]. Django: "publish suitable settings for development" [3].
- **Vendor, don't commit:** Next.js: "almost never" commit `.env` [4]. dotenv says no [5]. Rails' template ignores `/.env*` [6]. Vite is silent on `.env.[mode]` [7].
- **Vendor, stores:** Kubernetes puts non-confidential data in ConfigMaps [8]. AWS says Parameter Store's String type suits plain values [9]. OWASP doesn't define non-secret config [10].
- **Common practice:** twelve-factor rejects constants in code and named environment groups, but its open-source test concerns only credentials [11].
- **Common practice, projects:**
  - PostHog [12] and Open Collective [13] commit working dev config.
  - Cal.com, Forem, Documenso, Supabase and GitLab ship templates [14–18].
  - Integrations are usually blank or disabled, and mail goes to a local catcher.
- **Publishing, vendor:**

| Value | Vendor position |
|---|---|
| Google client ID | **Conflicting.** Google's examples put it in HTML [19], but its policy says never commit "client credentials" to public repos, without defining the term and stressing the secret [20]. GitHub's scanner lists "Google OAuth Client ID" [21]. |
| Apple Services ID | Goes in page meta tags [22]. |
| Apple Team ID | Appears as the app-ID prefix in the association file [23]; Apple's own live file shows one [24]. No explicit statement. |
| Apple Key ID | Only a JWT `kid` example [25]. No statement. Apple warns only about the private key [26]. |
| PostHog `phc_` key | "ok... to be public" [27]. |
| PostHog project ID | No statement found. |
| SMTP hostname | AWS publishes its endpoints; the password is the credential [28, 29]. |
| Sender address | Carried in the From field [30]. No vendor statement. |

- **Dev versus production:** no vendor assesses publication differently by tier. Google does require separate projects per tier [20]. `common/src/deployed-config.ts` shares one client ID across staging and production, so dev needs its own, and that existing sharing looks non-compliant.
- **Outside contributors:** GitHub withholds secrets from fork-triggered workflows [31]. Projects leave integrations optional, for example Forem's "Without keys, AI features are skipped" [15]; PostHog employees get extra keys from 1Password [12]. Bearing on the choice (agent judgement): committed values alone won't boot a fork, because `setFor[Development]` (`server/src/config/env.ts:197`) also requires secrets such as `GOOGLE_CLIENT_SECRET`. That needs a separate decision, ideally explicit disabled modes, to satisfy fail-loudly.

**3. Options (agent judgement)**

- **a. Committed typed config:** matches Symfony, Django, PostHog and the team's decision, and works from a fresh clone. It departs from twelve-factor's grouping objection, which is about scaling deploy names; here there is one development entry, and per-checkout values stay generated. Google's wording is the open risk. Commit the client ID knowing that, or ask Google. The production ID is already public.
- **b. Parameter Store:** AWS permits it, but it contradicts the team's decision and locks public values behind a login. No surveyed project does this for public values.
- **c. Hand-made `.env`:** the frameworks reserve local ignored files for per-machine overrides or secrets. It doesn't fix the fresh clone.
- **Better:** (a) plus explicit disabled modes for integrations.

**4. Could not verify**

- Whether Google's "client credentials" includes the ID.
- Apple's position on Team ID or Key ID. Its Key ID and Team ID help pages returned no article text.
- PostHog's position on project IDs.
- Ghost and Mattermost configs (404).
- Sources [8], [10] and [30] were partly read through summaries. The project survey is a small sample, not a census.

**Sources** (read through fetch tools)

1. [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749.txt): §2.2
2. [Symfony](https://symfony.com/doc/current/configuration.html): `.env` sections
3. [Django checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/): intro
4. [Next.js](https://nextjs.org/docs/app/guides/environment-variables): full page
5. [dotenv](https://github.com/motdotla/dotenv): FAQ
6. [Rails gitignore](https://raw.githubusercontent.com/rails/rails/main/railties/lib/rails/generators/rails/app/templates/gitignore.tt): template
7. [Vite](https://vite.dev/guide/env-and-mode): full page
8. [ConfigMap](https://kubernetes.io/docs/concepts/configuration/configmap/): summary
9. [Parameter Store](https://docs.aws.amazon.com/systems-manager/latest/userguide/systems-manager-parameter-store.html): full page
10. [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html): part verbatim
11. [Twelve-factor](https://12factor.net/config): full page
12. [PostHog handbook](https://posthog.com/handbook/engineering/developing-locally): env files
13. [Open Collective](https://raw.githubusercontent.com/opencollective/opencollective-api/main/config/default.json): file
14. [Cal.com](https://raw.githubusercontent.com/calcom/cal.com/main/.env.example): file
15. [Forem](https://raw.githubusercontent.com/forem/forem/main/.env_sample): file
16. [Documenso](https://raw.githubusercontent.com/documenso/documenso/main/.env.example): file
17. [Supabase](https://raw.githubusercontent.com/supabase/supabase/master/docker/.env.example): file
18. [GitLab](https://raw.githubusercontent.com/gitlabhq/gitlabhq/master/config/gitlab.yml.example): header
19. [Google Identity](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid): client ID page
20. [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies): credentials and projects sections
21. [GitHub patterns](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns): table rows
22. [Apple Sign in JS](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple): meta tags, via its JSON
23. [Apple associated domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains): file format, via its JSON
24. [Apple live association file](https://www.apple.com/.well-known/apple-app-site-association): contents
25. [Apple client secret](https://developer.apple.com/documentation/accountorganizationaldatasharing/creating-a-client-secret): JWT example, via its JSON
26. [Apple private key](https://developer.apple.com/help/account/manage-keys/create-a-private-key): warning
27. [PostHog privacy](https://posthog.com/docs/privacy): API key answer
28. [SES endpoints](https://docs.aws.amazon.com/general/latest/gr/ses.html): table
29. [SES SMTP credentials](https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html): full page
30. [RFC 5322](https://www.rfc-editor.org/rfc/rfc5322.html): §3.6.2, summary
31. [GitHub secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets): fork note

## How long an Identity Center login lasts

### Question

How long an AWS IAM Identity Center login should last for a small engineering team.

Context: the Identity Center instance is an organization instance in the organization's management account, which also holds the workloads. It has an `AdministratorAccess` permission set with a 1-hour session. The same login is used by people and by AI coding agents running on their laptops, sometimes unattended for hours or overnight. A wrapper starts commands using this login and fails loudly when it has expired, and a locally running server loses S3 access when it expires. The team's plan is that only a `dev` permission set is permanently assigned, with staging and production access granted by temporary assignment, though admins also log in through the same instance. Options under consideration: keep the AWS default of 8 hours; 24 hours; 7 days or more, up to the 90-day maximum.

Questions:
- What exactly does each timer control: the Identity Center user interactive session (portal session), the permission set session duration, the CLI's access token and refresh token (`sso-session` configuration), and the OIDC client registration? Which one forces a person to run `aws sso login` again, and what renews automatically?
- Is the session setting instance-wide, or can it differ by user, group or permission set? Is there an inactivity timeout that applies to CLI sessions? Where is it configured, and does an API or Terraform resource manage it?
- What do AWS's docs and Well-Architected guidance recommend for this value, if anything?
- What do NIST SP 800-63B-4 (AAL1/AAL2 reauthentication limits, and whether they apply outside US federal systems), OWASP Session Management and Authentication guidance, CIS AWS Foundations Benchmark, CIS Controls, PCI DSS, and SOC 2 expectations say about session lifetime? Is any of it specific to privileged or administrator sessions?
- What do comparable identity providers default to and recommend for developer or CLI sessions: Okta, Microsoft Entra ID (sign-in frequency), Google Workspace, GitHub, Teleport, Tailscale?
- Do phishing-resistant MFA, device trust or token theft research (for example infostealer malware taking cached tokens from developer laptops) change the recommended length?
- Does a longer session increase the exposure of the cached token in `~/.aws/sso/cache`, and how is that token protected at rest?

### Report

**1. Answer**

There is no industry standard for this value. The closest published ceiling is NIST AAL2: 24 hours overall, 1 hour idle. Comparable products default to anything from 8 hours to 180 days. My view (agent judgement): 24 hours at most, not 7 days or more.

**2. Findings**

*Vendor recommendation (AWS):*

| Timer | Value | Behaviour |
|---|---|---|
| Interactive session | default 8h, 15 min–90 days | Fixed limit; expiry, logout or admin ending forces `aws sso login` [1,2] |
| CLI access token | hourly | Renews automatically through the refresh token, which is tied to the session [3,4] |
| Permission set | default 1h, 1–12h | Role credentials; can outlive the session (AWS example: 32h total) and survive its revocation [5,6,7] |
| Client registration | length undocumented | Refresh stops once expired; login re-registers [8,9] |

- The session is configured under Settings → Authentication. I found no per-user or per-group option and no documented idle timeout; only the permission set duration varies by set [1,2,5].
- No API sets it: `update-instance` covers only name and encryption [10]. Terraform has only the permission set's duration [11]. So it is console-only.
- AWS gives no number: "shorter durations for sensitive applications" and no longer than the role needs [2,5]. It advises against workloads in the management account [12].

*Formal standard:*
- NIST 63B-4 [13]: AAL1 SHOULD ≤30 days. AAL2 SHOULD ≤24h overall, ≤1h idle. AAL3 SHALL ≤12h. Limits MAY extend with device-bound mechanisms, and bearer secrets SHOULD NOT persist. Non-federal organizations "may consider" it [14]. I found nothing specific to administrators.
- ASVS 5.0 [15]: documented, risk-based limits, no numbers.
- NIST 800-53 AC-12 [16]: organization-defined.
- PCI 8.2.8 [17]: 15-minute idle, aimed at unattended consoles; a screensaver is the FAQ's example. Binding only for PCI scope.

*Common practice (product defaults):* Entra 90-day rolling [18], Google 14 days [19], GitHub SAML 24h [20], Tailscale 180 days [21]. Administrators get less: Okta Admin Console 12h/15-minute idle [22], Google Admin console 1h [19].

*Vendor recommendation:* Google suggests privileged users reauthenticate more often [23]. Microsoft reserves "every time" for cases like PIM elevation, warning about habitual prompting [18].

*Token theft:*
- Vendor recommendation: replay works despite completed MFA [24].
- Verified in source code: the cache is plaintext JSON, mode 0600 at creation, with refresh token and client secret; refresh carries no device proof [8,9].
- Common practice: stealers target `.aws\sso\cache` [25], and a stolen refresh token lasts as long as the session [26,27].
- I found no peer-reviewed study.

**3. Options** (agent judgement)

Phishing-resistant MFA protects sign-in, not a token stolen afterwards, and CLI tokens lack the device binding NIST requires for extension. So a longer session directly lengthens theft exposure.

- **8h:** Meets every numeric overall ceiling found except AAL3's margin-free case. Overnight agents fail loudly.
- **24h:** At NIST's AAL2 ceiling, matches GitHub, and covers overnight runs started the same day. It still misses the 1-hour idle guidance, which AWS can't enforce.
- **7–90 days:** Exceeds NIST with no compensating binding. The value is instance-wide, so administrators get it too, and any temporary assignment is reachable through a stolen token. Long-default products aren't comparable without their other controls, which I didn't assess.
- **Better than any length alone:** Move workloads out of the management account. Have the wrapper use an SDK profile, since exported credentials would die at the permission set's 1 hour.

**4. Not verified**

- PCI standard text (403), SOC 2 criteria (login-gated; third-party summaries showed no value), CIS Controls safeguard 4.3, Okta's general default, Teleport's default.
- CIS AWS Foundations: checked only through Security Hub's mapping [28], which has no session control.
- OWASP cheat-sheet timeouts: tool summary only.
- Client registration length; refresh token rotation.
- AWS's best-practices page returned no content.

**Sources** (read through a fetch tool, except 8–11)

1. [User interactive sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-interactive-sessions.html), [Configure](https://docs.aws.amazon.com/singlesignon/latest/userguide/configure-user-session.html): limits, console path
2. [Authentication sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/authconcept.html): session types, guidance
3. [CLI concepts](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso-concepts.html): refresh
4. [SDK SSO](https://docs.aws.amazon.com/sdkref/latest/guide/understanding-sso.html): refresh versus session
5. [Permission set duration](https://docs.aws.amazon.com/singlesignon/latest/userguide/howtosessionduration.html)
6. [Duration considerations](https://docs.aws.amazon.com/singlesignon/latest/userguide/user-session-duration-prereqs-considerations.html): 32h example
7. [End sessions](https://docs.aws.amazon.com/singlesignon/latest/userguide/end-active-sessions.html)
8. [botocore tokens.py](https://raw.githubusercontent.com/aws/aws-cli/v2/awscli/botocore/tokens.py): refresh logic
9. [botocore utils.py](https://raw.githubusercontent.com/aws/aws-cli/v2/awscli/botocore/utils.py): `JSONFileCache`, registration
10. Local AWS CLI 2.34.57 `sso-admin` help text; no AWS call
11. [Terraform ssoadmin directory](https://github.com/hashicorp/terraform-provider-aws/tree/main/internal/service/ssoadmin): file listing only
12. [Management account practices](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_best-practices_mgmt-acct.html)
13. [SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html): reauthentication, section 5
14. [SP 800-63-4](https://pages.nist.gov/800-63-4/sp800-63.html): scope
15. [ASVS 5.0 V7](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x16-V7-Session-Management.md)
16. [AC-12 rendering](https://csf.tools/reference/nist-sp-800-53/r5/ac/ac-12/)
17. [PCI 8.2.8 FAQ](https://www.pcisecuritystandards.org/faq/articles/Frequently_Asked_Question/what-is-the-purpose-of-pci-dss-requirement-8-2-8-which-requires-users-to-reauthenticate-after-15-minutes-of-idle-time)
18. [Entra session lifetime](https://learn.microsoft.com/en-us/entra/identity/conditional-access/concept-session-lifetime), [how-to](https://learn.microsoft.com/en-us/entra/identity/conditional-access/howto-conditional-access-session-lifetime)
19. [Google session length](https://knowledge.workspace.google.com/admin/security/set-session-length-for-google-services)
20. [GitHub SAML reference](https://docs.github.com/en/enterprise-cloud@latest/admin/managing-iam/iam-configuration-reference/saml-configuration-reference)
21. [Tailscale key expiry](https://tailscale.com/kb/1028/key-expiry)
22. [Okta Admin Console](https://support.okta.com/help/s/article/admin-session-lifetime-idle-timeout-security-enhancements)
23. [Google Cloud session length](https://knowledge.workspace.google.com/admin/security/set-session-length-for-google-cloud-services)
24. [Microsoft token theft playbook](https://learn.microsoft.com/en-us/security/operations/token-theft-playbook)
25. [Check Point](https://research.checkpoint.com/2026/infostealer-riding-the-ai-train/): targeted paths
26. [Wiz](https://www.wiz.io/blog/infostealer-incursion-cloud-ai-credentials): cache claims; its appendix contradicts them on lifetime
27. [Zscaler/Red Canary](https://www.zscaler.com/blogs/cybersecurity-best-practices/aws-sso-access-tokens): cache contents, attack path
28. [Security Hub CIS mapping](https://docs.aws.amazon.com/securityhub/latest/userguide/cis-aws-foundations-benchmark.html)

## S3 conditional writes

### Question

How S3 conditional PUTs behave, which the conditional-PUT upload rests on. Read 2026-11-10 by a fetch subagent and checked against the page fetched directly.

### Findings

- **S3 conditional writes** (vendor documentation, [conditional writes](https://docs.aws.amazon.com/AmazonS3/latest/userguide/conditional-writes.html)). With `If-None-Match: *`, a PUT to an existing key "fails, resulting in a `412 Precondition Failed` response"; with `If-Match`, "If the ETag doesn't match, the write operation fails with a `412 Precondition Failed` response." "You can also receive a `409 Conflict` response in the case of concurrent requests", and "uploads may be retried after receiving a `409 Conflict` error." Under `If-Match`, a concurrent delete gives 404: "You should reupload the object when you receive a `404 Not Found` response." On versioned buckets the conditions apply to the current version. `If-Match` needs "the `s3:PutObject` and `s3:GetObject` permissions".

## Measurements

### A failed credential refresh under Bun (2026-11-09)

Bun 1.3.6 and `@aws-sdk/credential-provider-node` 3.972.29. A script ran the SDK's `memoizeChain` with a provider that returned credentials expiring in 2 minutes, inside the SDK's 5-minute refresh window, then threw `Token is expired. To refresh this SSO session run 'aws sso login'`. The second call returned the still-valid credentials, the background refresh rejected with no handler, and the process printed the error and exited 1. `server/src` has no `unhandledRejection` handler. A real session expiry was not exercised end to end.

### Response timeouts and proxies under Bun (2026-11-11)

Bun 1.4.4, `@smithy/node-http-handler` 4.5.1 (under `@aws-sdk/client-s3` 3.1023.0), `https-proxy-agent` 9.1.0 and `proxy-from-env` 2.1.0, which the client no longer uses.

- A local HTTP server answered a GET with headers and one of ten body bytes, then stalled, and answered a HEAD with 403. `chatsClient` with a 6-second idle timeout ran `getObject` and `putLatest` against it. Without the body timer both were still pending after 20 seconds; with it the GET failed after 6 seconds with the body-idle error and `putLatest` returned the HEAD's 403. With timeouts under 6 seconds the handler installs its socket timeout at once and the stall fails anyway, so the test uses 6 seconds. The handler's source explains why (see Proxies and response timeouts).
- With `HTTPS_PROXY` naming a local TCP listener, a request through `chatsClient` reached it as `CONNECT alliance-agent-chats.s3.us-west-2.amazonaws.com:443 HTTP/1.1`. With `NO_PROXY=localhost,.amazonaws.com`, or with only `ALL_PROXY` set, the proxy listener saw nothing and the request, redirected to a second local listener, opened with a TLS handshake record. Before this change Codex's probe found the SDK client connected directly whatever `HTTPS_PROXY` said, also with `NODE_USE_ENV_PROXY=1`.
- `HTTPS_PROXY=127.0.0.1:<port>`, with no scheme, made AWS CLI 2 (`aws s3 ls --no-sign-request`) send `CONNECT example-bucket.s3.us-west-2.amazonaws.com:443` in plain text to a local listener. Given the same value, `proxy-from-env` 2.1.0 returns `https://127.0.0.1:<port>`, and through `https-proxy-agent` the listener received a TLS handshake record; with `http://` added first it received the CONNECT.
- With `HTTPS_PROXY` naming a local listener (2026-11-11, AWS CLI 2.34.57, `aws s3 ls s3://example-bucket --no-sign-request`), `NO_PROXY=amazonaws.com`, `s3.us-west-2.amazonaws.com` or `*` sent the request direct, while `zonaws.com` and `*.amazonaws.com` sent `CONNECT example-bucket.s3.us-west-2.amazonaws.com:443` to the listener. Python 3's `urllib.request.proxy_bypass_environment` gives the same answers for the bucket's host, and also bypasses for `.amazonaws.com` and `AMAZONAWS.COM`. `proxy-from-env` 2.1.0's `getProxyForUrl` proxied for `amazonaws.com` and `s3.us-west-2.amazonaws.com` (reviewer's probe, round 36), since it matches an entry without a leading `.` or `*` only exactly.

## Proxies and response timeouts

### Question

What the transcript client's proxy support and response-body timer rest on. Read 2026-11-11 by a fetch subagent.

### Findings

- **Smithy's socket timeout** (vendor source, [set-socket-timeout.ts](https://raw.githubusercontent.com/smithy-lang/smithy-typescript/@smithy%2Fnode-http-handler@4.5.1/packages/node-http-handler/src/set-socket-timeout.ts) and [node-http-handler.ts](https://raw.githubusercontent.com/smithy-lang/smithy-typescript/@smithy%2Fnode-http-handler@4.5.1/packages/node-http-handler/src/node-http-handler.ts), 4.5.1). A timeout above 0 and under 6000 ms is registered at once (`if (0 < timeoutInMs && timeoutInMs < 6000)`); any other is registered by a timer after `DEFER_EVENT_LISTENER_TIME` (3000 ms). That timer's handle goes in `timeouts`, which the response callback's `resolve` clears (`timeouts.forEach(timing.clearTimeout)`), so headers arriving within 3 seconds leave the socket with no idle timeout.
- **AWS CLI proxies** (vendor documentation, [Using an HTTP proxy](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-proxy.html)). It names `HTTP_PROXY` and `HTTPS_PROXY`, and `NO_PROXY` for the instance metadata service; it never mentions `ALL_PROXY` or SOCKS. "If you specify a variable twice using different cases, the lowercase letters take precedence."
- **https-proxy-agent** (common practice, [README](https://github.com/TooTallNate/proxy-agents/tree/main/packages/https-proxy-agent)). An `http.Agent` that tunnels HTTPS through an HTTP or HTTPS proxy with `CONNECT`; it takes the proxy URL as an argument and reads no environment variables.
- **proxy-from-env** (common practice, [README](https://github.com/Rob--W/proxy-from-env)). `getProxyForUrl` picks the proxy variable by the URL's protocol, falls back to `ALL_PROXY`, and returns an empty string when the URL matches `NO_PROXY`.
