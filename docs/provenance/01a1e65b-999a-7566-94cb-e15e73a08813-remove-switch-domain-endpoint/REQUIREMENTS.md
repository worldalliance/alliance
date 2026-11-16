---
user: Charles Lien
task: Do the next issue in the "Finish the domain move to thealliance.org" Linear project, ALL-2200 (remove the no-op POST /user/switch-domain endpoint), on the `domain` branch and open a PR
---

- Implement Linear issue ALL-2200, "Remove the no-op POST /user/switch-domain endpoint", on the `domain` branch and open a pull request for it. (agent-proposed as the project's next issue, user-approved)
- Delete the `switchDomain` route, marked `BACKCOMPAT(ALL-2200)`, from `server/src/user/user.controller.ts`, and regenerate the API client so `userSwitchDomain` and the `UserSwitchDomain*` types leave `shared/client/sdk.gen.ts` and `shared/client/types.gen.ts`. (from ALL-2200, user-approved)
- Start only once production shows no `POST /api/user/switch-domain` for a day after the production cutover (ALL-2140) deployed. (from ALL-2200, user-approved)
