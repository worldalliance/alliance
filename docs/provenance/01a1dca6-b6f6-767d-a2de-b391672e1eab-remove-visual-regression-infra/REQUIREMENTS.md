---
user: Charles Lien
task: Create the PR for ALL-2169, removing visual regression's AWS role and CI storage bucket, fully reviewed, before applying its Terraform.
---

# Requirements

This is the infrastructure PR of `docs/provenance/01a1cf98-3584-726f-a507-05fc83605522-remove-visual-regression` (ALL-2162), in the plan in `docs/provenance/01a1ce4b-16f7-713d-9845-fe08e3ffa147-ci-deploy-speed`. That task's requirements govern this one; these are the ones it carries out.

- **The S3 bucket `alliance-ci-storage-32a7c624` is deleted entirely,** with its policies, the dev IAM user's access to it, and all its contents, the unrelated `review-workflow/` prefix included. Nothing is saved first (user, from ALL-2162).
- **The `visual-regression` AWS role and the parameters it reads are deleted** (user, from ALL-2162).
- **The user applies the infrastructure changes.** The agent writes a saved plan (`terraform plan -out`) and lists every destroy in it; the user reviews `terraform show` of that plan and applies that exact file with their own credentials, then deletes `ci/visual-regression/GEMINI_API_KEY`, `ci/visual-regression/ANTHROPIC_API_KEY` and `ci/visual-regression/SLACK_BOT_TOKEN`, and no other parameter (approved research recommendation, from ALL-2162).
- **The PR is opened and fully reviewed before the Terraform is applied** (user).
- **The same apply also applies PR #969's unapplied `mms-media/` bucket policies and lifecycle rules** on the prod and staging assets buckets (agent-proposed, user-approved).
