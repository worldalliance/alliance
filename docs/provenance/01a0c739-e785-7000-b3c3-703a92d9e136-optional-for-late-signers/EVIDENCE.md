# Evidence

Baseline codebase state unless noted: `main` at `13d185e4c` ("fix ci"). Working directory is the
repo root, `/Users/charles/github/alliance`, except where a command names `server/`.

## Viewer status hardcoded the optional fields on `main`

Method: read `server/src/actions/user-action-status.ts` at `13d185e4c`.

The return of `resolveUserActionStatus` (around L246) reads:

```ts
  return {
    assigned,
    optional: action.optional,
    optionalReason: null,
```

Searching for the enum's only declared variant:

```
$ grep -rn --include="*.ts" --include="*.tsx" "ContractGap|contract_gap" server apps shared common sharedweb
```

Matches in `server/src` are the enum declaration (`user-action-status.ts:107`), the DTO field
(`dto/action.dto.ts:285,326`), and two lines in `user-action-status.spec.ts` (L155, L160) inside a
case titled "rejects a reason without optional: true at typecheck". Matches outside `server/src` are
client-side: `shared/lib/actionUtils.ts`, `shared/lib/copy.ts`, `shared/lib/actionPageTaskPanel.ts`,
`shared/lib/largeActionCard.ts`, `apps/frontend/src/components/ActionPageTaskPanel.tsx`,
`apps/mobile/components/ActionPageTaskPanel.tsx`, and their tests.

## Assignment required a contract across the whole member-action window

Method: read `server/src/utils/action-user.ts` at `13d185e4c`.

`computeIsAssignedCore` (L58-L103) ended:

```ts
return (
  includeSuspended ||
  user.hasActiveContractInFullRange({
    startDate: eventDate,
    endDate: deadlineDate,
  })
);
```

`User.hasActiveContractInFullRange` (`server/src/user/entities/user.entity.ts:630-662`) returns false
when the latest contract event at or before `startTime` is not `SIGNED`.

## The prior behaviour was asserted by an end-to-end test

Method: read `server/test/actions.e2e-spec.ts` at `13d185e4c`, L1421-L1500.

The case "excludes shouldComplete flag for users without eligible contracts when not an onboarding
action" creates `lateSigner` with a single `SIGNED` contract event dated `event.date + 1000` ms and
asserted `lateAction!.shouldParticipate).toBe(false)`.

## Origin of the wire format

```
$ git log --oneline -S "ContractGap" --all
```

Output included `beff4a51d Optional for late signers (#171)`.

```
$ git merge-base --is-ancestor beff4a51d main && echo "ON MAIN"
```

Printed `ON MAIN`.

`git show --stat beff4a51d` includes, in the commit message:

> optionalReason carries it: null unless optional is true where action.optional is false. ContractGap
> is the only variant, for a member whose contract missed part of the member-action window. The
> server sends null everywhere today, and the rule that widens optional sets the reason with it.

## Stated contract for the reason field

Method: `git log -1 --format=%B 17c0f241d` ("say optional for you where only the viewer's flag is
set"), a commit reachable from `main`. Its body contains:

> Neither surface checks that the phase has opened, and both contract-gap sentences say the task has
> already been open. The rule that widens optional sets contract_gap only once memberActionStarted is
> true.

## An implementation exists on an unmerged local branch

```
$ git log --oneline main..stable-action-assignments
9e2839534 Add admin assignment controls and audited corrections
b74a8abaa Use saved assignments across action consumers
ff9e96ef6 Add transactional assignment settlement and backfill
869ce64a8 Add stable assignment storage and decision rules

$ git merge-base --is-ancestor main stable-action-assignments && echo "up to date" || echo "BEHIND main"
BEHIND main

$ git ls-remote --heads origin stable-action-assignments
28492e068c30e10de8aae6e0fda71515e81f4d3e	refs/heads/charles/stable-action-assignments
```

`28492e068` is a `main` commit ("update agentic workflow"), not a branch tip carrying those four
commits.

`git show stable-action-assignments:server/src/actions/user-action-status.ts` computes the field at
L206-L217, through `isSavedAssignmentOptional({ action, user, assignment: params.assignment })`, and
carries a second variant, `ViewerOptionalReason.LateAssignment`, that `main` does not declare.

That branch was read only. It was not checked out and was not modified.

## Callers of the two assignment predicates

Method: `graft callers <symbol>` at `13d185e4c`.

`computeIsAssignedAndPresent` ← `buildSuspendPlanContext`
(`server/src/actions/actions.service.ts:4089`), `filterForShouldRemind` and `findBaseUsersForEvents`
(`server/src/notifs/action-event-recipient.service.ts:561,424`).

`computeIsAssignedToAction` ← `computeIsInCohortExpression` (`actions.service.ts:5150`),
`findMemberPublic` (`:959`), `findOneDto` (`:1211`), `resolveUserActionStatus`
(`server/src/actions/user-action-status.ts:223`).

## Population the roster filters over

Method: read `server/src/user/user.service.ts:1380-1412`.

`findActiveUsersWithTags`, `findActiveUsersForRoster` and `findActiveUserIds` each issue a
`userRepository.find` with no `where` clause.

## Reminder task lists read `shouldParticipate`

Method: read `server/src/actions/actions.service.ts` and `server/src/notifs/action-event-notif.worker.ts`.

`findUncompletedTasks` keeps `findMemberPublic` results with `action.shouldParticipate` and no
completion. Its only caller, `findUncompletedTasksForPlan` in the worker, drops optional tasks under
`excludeOptionalActions` by `!task.optional`, and `ActionDto.optional` is `action.optional`
(`server/src/actions/dto/action.dto.ts:501`). `processCustomReminderText` feeds the list into
`uncompletedTasksCount`, `uncompletedTasksNames` and `uncompletedTasksTime`.

Before the `findUncompletedTasks` filter was added, the e2e case "leaves an action optional only for
a mid-window signer out of their reminder task list" failed:

```
error: expect(received).not.toContain(expected)
Expected to not contain: 5
Received: [ 1, 3, 4, 5 ]
```

## Checks after the change

Codebase state: branch `charles/optional-for-late-signers`, the change described in `DECISIONS.md`
applied.

```
$ (cd server && bun run typecheck)
$ tsc --noEmit && eslint "{src,apps,libs,test}/**/*.ts"
```

Exit status 0, no diagnostics printed.

```
$ (cd server && bun test)
 538 pass
 0 fail
```

```
$ (cd server && bun run test:e2e)
 830 pass
 2 skip
 0 fail
Ran 832 tests across 30 files. [74.36s]
```

```
$ bun run test
==> server      538 pass  0 fail
==> common      823 pass  0 fail
==> shared      518 pass  0 fail
==> sharedweb    99 pass  0 fail
==> apps/frontend 122 pass  0 fail
==> apps/admin  190 pass  0 fail
==> apps/mobile  54 pass  0 fail
```

```
$ bun run format:check
All matched files use Prettier code style!
```

No check was run against a browser or a deployed environment.
