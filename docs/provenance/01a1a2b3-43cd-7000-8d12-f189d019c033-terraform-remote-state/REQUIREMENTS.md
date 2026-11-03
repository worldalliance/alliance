---
user: Charles Lien
task: Move Terraform state from a local file to a shared remote backend
---

# Requirements

- Terraform state for `terraform/` lives in a shared remote backend instead of a local `terraform.tfstate`, so teammates run `plan`/`apply` against one current copy without passing the state file around. (user)
- The backend follows established industry practice: an S3 bucket in the project's AWS account, with versioning, encryption, blocked public access, and state locking. (user-originated: industry standard; specifics agent-proposed, user-approved)
- How the state bucket itself is provisioned follows industry practice. (user)
