---
user: Charles Lien
task: Create the PR for ALL-2162, removing visual regression and adding an offline mobile bundle check, the first planned PR of the Faster CI deploys project.
---

# Requirements

This is the first PR of the plan in `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. Its **Visual regression removal** and **Mobile bundle check** requirements govern this task; they are restated here.

- **Everything visual regression is deleted** (user): the `visual-regression` job in `.github/workflows/deploy.yaml` and its entry in `checks`, `.github/workflows/mobile-visual-regression-ios.yaml`, `.github/workflows/approve-visual-baseline.yaml`, the `visual-regression` AWS role and the parameters it reads, `VISUAL_REGRESSION_BUCKET` and `SLACK_VISUAL_REGRESSION_CHANNEL_ID` in `.github/ci.env`, and their docs in `docs/ci-secrets.md`.
- **The S3 bucket `alliance-ci-storage-32a7c624` is deleted entirely,** with its policies, the dev IAM user's access to it, and all its contents, the unrelated `review-workflow/` prefix included. Nothing is saved first (user).
- **The user applies the infrastructure changes.** The agent writes the Terraform change and a saved plan (`terraform plan -out`) and lists every destroy in it; the user reviews `terraform show` of that plan and applies that exact file with their own credentials. After the workflow changes merge, the user deletes `ci/visual-regression/GEMINI_API_KEY`, `ci/visual-regression/ANTHROPIC_API_KEY` and `ci/visual-regression/SLACK_BOT_TOKEN`, and no other parameter (approved, research recommendation).
- **A mobile bundle check runs in PR CI and gates staging.** A job in `ci.yaml`, and a job that `deploy.yaml`'s `checks` requires, run an offline production-variant `expo export` for iOS and Android with `APP_VARIANT=production` and no secrets (approved, agent recommendation).
- **The work lands as a pull request from the existing `ci` worktree and branch** (user).
