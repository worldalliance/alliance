# Split ShareUrlsService under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file, with no behavior change. The layout starts from the persistence extraction every option `codex exec -s read-only` proposed per the repo's file-size rule.
- Row creation moves to `share-url-rows.ts` as plain functions taking an `EntityManager`, like the existing `share-url-locks.ts`: `getOrCreateShareUrl` (find the canonical link, or create it and recover from a unique-violation race), `buildAndSaveShareUrl` (owner and target locking, sid and URL generation, the insert), and `lockExternalTarget`. They use no injected dependency, so a service would add only wiring. Bodies move unchanged apart from the renamed self-call and error prefixes.
- `ShareUrlOwner`, `ownerWhere`, and `ownerColumns` move to `share-url-owner.ts`, since the service, the row functions, `share-url-locks.ts`, and the controller all use them. Importing them from `share-urls.service.ts` would make the row module and the service import each other.
- A member's reusable invite links move to `InviteShareUrlsService` (`invite-share-urls.service.ts`), as in `codex`'s second option: creating one with a chosen group (with the leadership check), editing and deleting it, listing a member's invites with their destination groups, the admin reusable-invite feed, and the invite message template. It injects `ShareUrlsService` for signup counts and `createDuplicateForInvite`, which becomes public; `ShareUrlsService` does not depend on it back, so no provider cycle forms. `codex`'s separate query service is left out: the two extractions already bring the file well under the limit, and it would move the lookups other modules call.
- `ShareUrlsService` keeps link creation for every kind, owner and campaign lists, signup counts, labels, admin deletion, external-target URL recomputation, and the lookups other modules call, so `ActionsService`, `TasksService`, `ReferralService`, `UserService`, and `ExternalShareTargetsService` are unchanged.
- `ShareUrlsController` injects both services and keeps every route, so operation ids and the generated client are unchanged. E2E tests that call the moved methods get them from `InviteShareUrlsService`.
- Two commits, each typechecking alone: the row extraction, then the invite service, which brings the file under the limit and removes the waiver, since eslint reports an unused one as an error.

## Left as found

- `ActionsController` injects `ShareUrlsService` and never calls it.
