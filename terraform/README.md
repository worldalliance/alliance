# Terraform

State lives in the S3 bucket `alliance-terraform-state-751910243706` (see `state.tf`), so everyone plans and applies against one copy. It needs Terraform 1.10 or later.

Run `terraform init` in this directory before the first `plan`. After adding or upgrading a provider, run `terraform providers lock -platform=darwin_arm64 -platform=linux_amd64` and commit `.terraform.lock.hcl`, so it keeps both platforms' hashes.

If `init` offers to copy existing local state to the new backend, answer **no**: that local `terraform.tfstate` is a stale copy from before the move, and copying it overwrites the shared state. Then delete `terraform.tfstate` and `terraform.tfstate.backup` here.

The bucket is versioned. To undo a bad write, restore an earlier version of the `terraform.tfstate` object.

## GitHub

Besides AWS, this root manages the GitHub environments CI's roles use and their deployment branch rules (`github.tf`), so every `plan` and `apply` also needs a GitHub login. With `GITHUB_TOKEN` unset, the provider takes the token from `gh auth token`. A plan reads with any login on the repository; an apply that changes an environment needs the token's account to be a repository admin.

CI never applies this root: changing environment settings needs repository Administration permission, which the Actions `GITHUB_TOKEN` can't be granted, and an admin token stored for CI would let a compromised workflow loosen the rules that gate the production roles.
