## Target

The agent coordinating several parallel worktrees, each on a different waived file, assigned this one, so the split can't collide with parallel work (REQUIREMENTS.md).

## Fix

The waiver defers splitting a file over the 500-line limit, so the fix is the split. Each group moves into its own file under `server/src/user/dto/` unchanged:

- `user-admin.dto.ts`: `UserAdminDetailDto` with its invited-by and location parts, plus the admin role-update and delete request DTOs.
- `user-visibility-context.dto.ts`: `MyVisibilityContextDto` and `UserPropertyPresenceDto`.

`user.dto.ts` keeps `UserDto`, `ProfileDto` and the DTOs built on them, which most of the 36 importing files use, so those imports stay as they are.

A move changes no class names or decorators, so the OpenAPI schema and the generated client in `shared/client/` stay unchanged.
