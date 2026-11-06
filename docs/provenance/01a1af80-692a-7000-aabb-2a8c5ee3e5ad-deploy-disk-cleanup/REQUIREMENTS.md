---
user: Charles Lien
task: Fix the failing CI on main, prevent it from happening again, and open a PR.
---

# Requirements

- The Deploy workflow on `main` passes again. It failed at "Upload React Build to EC2" because the staging host's disk was full. (user-originated)
- Deploys stop filling the EC2 hosts' disks in the future. (user-originated)
