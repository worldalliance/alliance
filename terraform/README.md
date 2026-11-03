# Terraform

State lives in the S3 bucket `alliance-terraform-state-751910243706` (see `state.tf`), so everyone plans and applies against one copy. It needs Terraform 1.10 or later.

Run `terraform init` in this directory before the first `plan`.

If `init` offers to copy existing local state to the new backend, answer **no**: that local `terraform.tfstate` is a stale copy from before the move, and copying it overwrites the shared state. Then delete `terraform.tfstate` and `terraform.tfstate.backup` here.

The bucket is versioned. To undo a bad write, restore an earlier version of the `terraform.tfstate` object.
