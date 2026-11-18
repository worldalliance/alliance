---
user: Charles Lien
task: Open a PR on branch `ci` for Linear issue ALL-2274, the next issue in the Faster CI deploys project.
---

# Requirements

- The `.github/actions` tests use one fake `gh` CLI instead of two: the route-based one from `.github/actions/promote/fake-gh.ts` moves to a shared spot, `deploy-guard`'s tests run on it, and `.github/actions/deploy-guard/fake-gh.ts` is deleted. (User-approved; proposed in ALL-2274, filed from branch `ci`'s review loop for `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`.)
- `bun test ./.github/actions` passes. (User-approved; from ALL-2274.)
