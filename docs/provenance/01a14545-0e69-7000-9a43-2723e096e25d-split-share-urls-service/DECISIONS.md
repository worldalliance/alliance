# Split ShareUrlsService under the 500-line limit

[REQUIREMENTS.md](./REQUIREMENTS.md) defines the task. The choices below are agent-authored.

## Split

- The fix the waiver asks for is splitting the file, with no behavior change. The layout starts from the persistence extraction every option `codex exec -s read-only` proposed per the repo's file-size rule.
- Row creation moves to `share-url-rows.ts` as plain functions taking an `EntityManager`, like the existing `share-url-locks.ts`: `getOrCreateShareUrl` (find the canonical link, or create it and recover from a unique-violation race), `buildAndSaveShareUrl` (owner and target locking, sid and URL generation, the insert), and `lockExternalTarget`. They use no injected dependency, so a service would add only wiring. Bodies move unchanged apart from the renamed self-call and error prefixes.
- `ShareUrlOwner`, `ownerWhere`, and `ownerColumns` move to `share-url-owner.ts`, since the service, the row functions, `share-url-locks.ts`, and the controller all use them. Importing them from `share-urls.service.ts` would make the row module and the service import each other.
