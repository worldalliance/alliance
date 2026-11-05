# Decisions

## Research behind the requirements

Each requirement's option was checked against published practice before the user chose it.

- Split roles: NIST AC-6 and the AWS Well-Architected least-privilege practice. AWS's stronger recommendation, a separate account per environment, is out of scope.
- Human apply as non-root: HashiCorp recommends human review of production plans; AWS reserves the root user for tasks that need it.
- Committed CA bundle: NIST SP 800-57 treats a trust anchor's public key as non-secret.

## Implementation

- **`DB_CA_CERT` stays exported under `BACKCOMPAT(ALL-1963)`**, read from the release's committed bundle, because a release from before the server read that bundle has no fallback for it. Origin: agent decision.
- **The staging role gets `s3:DeleteObject` on the staging bucket.** The server deletes objects (`videos.service.ts`, `hosted-docs.service.ts`), and the old shared role granted delete on production's bucket but not staging's, so staging deletes were denied. Origin: agent decision.
- **The staging backend restarts right after the apply that gives staging its own role.** The apply moves the staging bucket's policy off the shared role, and a running backend keeps the shared role's credentials until they expire, so staging uploads and deletes fail until then. The setup steps given to the user include the restart. Origin: agent decision.
- **The production role drops the dev assets bucket.** The production server uses only its own bucket; the `alliance-dev` IAM user keeps dev bucket access. Origin: agent decision.
- **Workflows don't set `TF_VAR_db_password`.** No workflow runs Terraform, and set at workflow level it handed each job deploying to staging or production that environment's database password. Origin: agent decision.
- **Failures before the old backend is stopped leave it running instead of restarting it.** That covers unzip, install, entering the new release, reading the streak recognition removal state, an unrecognized state, and migrations that run with the old backend up. The old backend never stopped, so a restart there only adds downtime and another way to fail. The exception is an old backend that exited during the deploy: pm2 brings it back from its recorded path, which holds the new release by then, so a changed pid, or a pid where there was none because pm2 was between restarts as the deploy began, gets it restarted from the old release once that is moved back. A backend that wasn't running when the deploy began and hasn't come up since stays stopped: after a failure that left it stopped, starting the old release could run old code against a schema not yet restored. A deploy that can't read the backend's pid from pm2 quits before touching anything, since an empty pid would pass for no backend running. A failure whose own pid read fails restarts nothing and says to check the backend by hand, since a restart there could take down a healthy old backend. Origin: agent decision.
