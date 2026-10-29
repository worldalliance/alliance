# Preservation policy

The user deferred whether work is archived at all, what an archive contains, and its retention period. Omit archival and restoration in the first implementation: its purpose is removing temporary environments, and recovery was not considered valuable enough to require it. This is an agent choice that may be replaced if it causes friction.

Per the Removal requirements, cleanup discards staged and unstaged edits, untracked and ignored files, and local database changes in the selected worktrees, and deletes the branches created for them. Remote branches and pull requests remain untouched. Document this behavior in command help so callers understand the operation they invoke.

Neither merge detection nor squash-merge recognition gates cleanup. The agents' merge strategies vary, and retaining environments until incorporation can be proved defeats unattended cleanup. No archive directory, expiration mechanism, or recovery command is needed under the chosen policy.

# Creation and ownership

- Preserve full environment provisioning and the existing sibling-directory layout. Parentage expresses lifecycle ownership, not filesystem nesting.
- Resolve the creating checkout from the invocation directory when it belongs to this repository; otherwise use the checkout containing the invoked script. Resolve the default code revision there, and continue honoring an explicit `--from`. Read copied configuration and source database settings from the main checkout as required.
- Persist parentage and which branch the script created alongside worktree metadata. Use checkout identity rather than the current branch name for parentage, so switching branches does not move a child between parents.
- An existing branch supplied to `--branch` remains user-owned. Cleanup removes its checkout but retains that branch. Delete only explicitly owned branches, not branches selected by a naming pattern or newly discovered during cleanup.
- Apply parent tracking to newly created worktrees. Older worktrees retain direct named removal; infer no historical parentage from Git ancestry or directory names.

# Cleanup contract

- Extend `rm-worktree.sh <name>` to remove that worktree and its recorded descendants. The main checkout has no name and is never a removal target.
- Remove descendants before their parents. Unrelated worktrees, including the named worktree's own ancestors and siblings, remain outside the removal set.
- The caller stops and waits for its agents and development processes before cleanup. A planned desktop app can own this sequence; these scripts do not launch or supervise Claude or Codex. Preserve existing current-directory and Git worktree-lock protections rather than deleting the checkout running the caller or bypassing a lock.
- Coordinate creation with cleanup so a parent cannot acquire new children while its removal is underway. Keep ownership metadata until the corresponding resources are gone, allowing cleanup to resume after an interruption or partially failed creation.
- A failure to validate ownership or remove a resource produces a nonzero exit and a report naming what remains. Retain a parent while a descendant is unresolved; continue cleaning independent siblings. Retrying an interrupted cleanup treats already removed resources as complete.
- Preserve existing checks against deleting the main checkout or its database. Cleanup targets owned resources even when their names resemble another task's resources; uncertain ownership is an error.
- The commands run without interactive prompts once invoked. Report completion only when the selected resources are removed, and report retained pre-existing branches separately from incomplete cleanup.

# Implementation boundaries

- Keep Git, local environment setup, and cleanup usable directly from the command line. Desktop UI, provider integration, conversation storage, S3 synchronization, and agent orchestration belong to a future feature.
- Update the generated worktree instructions and script documentation to describe child creation, ownership, and the destructive cleanup contract.
- Keep the Bash-based macOS/Linux approach. Do not add a native Windows installer or substitute shell as part of this feature.

# Acceptance checks

Use disposable repositories, synthetic configuration, and disposable or stubbed database resources. The implementation is complete when these cases pass on macOS and Linux:

1. Create a child from a worktree and a grandchild from that child. Each records the correct parent, starts at its creator's committed revision by default, honors `--from`, receives its own ports and databases, and copies environment inputs from the main checkout.
2. Remove a child that has a child of its own. Remove both generations and their owned resources; preserve the child's parent and an unrelated sibling task.
3. Remove a parent from outside its subtree. Remove its descendants first and then the parent, including owned branches with unpublished commits and directories containing staged, unstaged, untracked, and ignored files.
4. Remove a child using a pre-existing branch. Preserve that branch and its commits while removing the child's environment. No remote ref or pull request is changed by either removal mode.
5. Fail a database deletion or filesystem removal midway through cleanup. Report incomplete cleanup, retain the metadata needed to retry, clean independent siblings, and complete successfully after the failure is resolved.
6. Interrupt creation and race child creation against parent cleanup. Leave no unregistered resource that cleanup cannot identify, and never add a child to a parent being removed.
7. Run simultaneous creations with distinct names and with conflicting names. Successful creations own distinct resources; failed calls leave other calls' resources intact. Run overlapping removals and reuse a removed name while an earlier removal is still finishing; preserve the replacement worktree and its resources.
8. Reject malformed or foreign ownership, a locked removal target, the main checkout as a removal target, and a removal set containing the caller's checkout. Do not remove unrelated resources while reporting these failures.
9. Remove a worktree created before parent tracking by its existing name, without treating unrelated legacy worktrees as descendants.

This directory specifies behavior; the scripts are not modified by the specification task.
