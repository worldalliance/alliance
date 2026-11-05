# Decisions

- **`NODE_ENV` stays exported.** `scripts/secrets_run.sh` picks the Parameter Store path by it and the server picks the committed config by it. Origin: agent decision, per the ALL-1962 decisions.
- **`deploy-nest-backend` no longer downloads or ships `deployed-config.env`.** Only the removed exports read it on the host; the server reads `common/src/deployed-config.ts`. Its `needs: deployed-config` goes with it. The `deployed-config` job stays for the web and verification jobs. Origin: agent decision, as ALL-2011 proposed.
- **Precondition checked on 2026-11-05:** staging's last backend deploy (`cf68f4a299`) includes ALL-1962 (#898) and ALL-1963 (#905); production ran ALL-1962 from `0ee43140d1`, and its deploy of `aca5a38891`, which includes ALL-1963, was in progress when this change was written. Origin: agent check of `gh run list`.
- **`scripts/deployed-config.ts` prints only `DOMAIN_NAME`, `ALT_DOMAIN_NAME` and `POSTHOG_PROJECT_ID`.** With the backend exports gone, the `deployed-config` action's outputs are its only reader; its test requires the printed keys to equal those outputs. Origin: agent decision, from review round 1 (`orphaned-server-keys`).
