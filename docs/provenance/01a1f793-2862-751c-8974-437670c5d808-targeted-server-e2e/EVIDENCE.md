# Evidence

## Transcript measurements

Method: Claude Code transcripts of this machine's alliance worktrees, read with `jq`, on 2026-11-19.

- In one review-loop session's server e2e run, 185 tests across 18 files took 811s, about 45s per file. Ten suites failed with `beforeAll` at 50,000ms, each followed by `afterAll` throwing `undefined is not an object (evaluating 'ctx.app')`. No assertion failed.
- Over the 3 days to 2026-11-19 (2,265 transcripts), Bash commands ran the full server e2e set (`bun run test:e2e` or `./test/*.e2e-spec.ts`) 164 times and named suites about 2,700 times. 157 e2e commands set `--timeout` to 100,000ms or more.

## Machine measurements

Method: `uptime`, `sysctl`, `iostat`, `ps`, `xcrun simctl` on 2026-11-19, macOS, 10 cores, 32 GiB RAM, Bun 1.4.4, the main checkout at commit 99c38cf0e4.

- Load average 690, swap 8.7 of 10 GB used, disk about 16k operations/s and 150 MB/s, 25 worktrees, 47 `claude` processes, several review loops running checks at once, one Android emulator (about 2 cores), two booted iOS simulators.
- In that state `server/test/health-db.e2e-spec.ts` alone passed in 8.3s.
- Each suite's setup, `createTestApp` in `server/test/e2e-test-utils.ts`, runs `dataSource.synchronize(true)`, dropping and rebuilding the whole schema. Setup phases were not timed individually.

## Research

Checked 2026-11-19 by a researcher subagent.

- Django builds the test database once per run and isolates tests with transactions ([testing overview](https://docs.djangoproject.com/en/stable/topics/testing/overview/)); Rails loads the schema once and wraps tests in rolled-back transactions ([testing guide](https://guides.rubyonrails.org/testing.html)). Vendor recommendation. NestJS's testing docs say nothing about test database setup ([docs](https://docs.nestjs.com/fundamentals/testing)).
- Bun, Jest, Django and Rails size test workers to one run's cores and assume that run has the machine; none addresses many independent runs on one machine ([bun parallel](https://bun.com/docs/test/parallel), [Jest config](https://jestjs.io/docs/configuration)). Vendor recommendation; no established practice found for limiting concurrency across independent runs.
- About 46.5% of flaky tests in 52 projects run under 27 resource configurations failed only when resources were limited ([Silva et al., arXiv 2310.12132](https://arxiv.org/abs/2310.12132)). Research-backed.
- Rerunning failing tests until they pass makes them useless; fix or quarantine them ([Fowler](https://martinfowler.com/articles/nonDeterminism.html)). Common practice (expert essay).
- By default Nx treats a lockfile change as affecting every task; its `projectsAffectedByDependencyUpdates: "auto"` narrows that to projects whose resolved dependencies changed ([affected](https://nx.dev/docs/features/ci-features/affected)). Vendor recommendation; checked 2026-11-19.
