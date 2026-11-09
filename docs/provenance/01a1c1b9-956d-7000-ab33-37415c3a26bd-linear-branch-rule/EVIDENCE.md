# Evidence

Checked 2026-11-09 by a research subagent. Status per the root `AGENTS.md` **Established practice**. No formal standard, published research or common practice was found on this question.

## Question

Under what conditions should a branch carry its Linear issue's key?

## Vendor documentation

- A key anywhere in a branch name links the PR. Magic words in the PR title, description or commit message also link, and editing an open PR's description links it. Linear waits for the final linked PR before completing an issue. The closing words are every tense of close, fix, resolve, complete and implement, and the phrase `linear issue`, placed before the key, and several keys can follow one word (`Fixes ENG-123, DES-5, and ENG-256`); the docs don't say whether a commit message link attaches the PR. https://linear.app/docs/github
- Renaming a branch closes its open pull request. https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-branches-in-your-repository/renaming-a-branch
- Postgres identifiers are limited to 63 bytes. https://www.postgresql.org/docs/current/sql-syntax-lexical.html#SQL-SYNTAX-IDENTIFIERS

## Measurements in this repository

Queried through `gh` and the Linear API on 2026-11-09.

- Last 100 merged PRs, #816 to #934, counting a key in the title, description or commit messages as text: 21 head branches contain a key, all with a key in text too; 39 have a key in text only; 40 have no key.
- ALL-2087, on branch `sync-cron` with `Fixes ALL-2087` in the commit and PR description: PR attached, Done 3 seconds after merge.
- A branch key with only `Refs` or `Part of` text didn't complete at merge (#898, #933).
- Issues keyed in the branch got a PR attachment (ALL-1935 on #917, ALL-1943 on #920). Issues with `Fixes` only in commit messages (ALL-1931 on #917, ALL-1942 and ALL-1944 on #920) got commit attachments and none for that PR, and reached Done at merge. ALL-1942 and ALL-1944 do carry an attachment for the earlier #873, whose description lists them under Follow-ups with no closing word; #920's description also names them with no closing word and attached nothing.
- Editing the description after the PR opened linked and completed ALL-1972, ALL-2009 (#868) and ALL-1914 (#843).
- #868's description reads `filed instead of fixed: ALL-2071 to ALL-2079`. ALL-2071, which that PR didn't fix, got the PR attachment and went Done 3 seconds after merge. ALL-2072, ALL-2073 and ALL-2079 from that range, and ALL-1971, ALL-1973 and ALL-2010 listed with no closing word, stayed Backlog with no attachment. That `fixed:` triggered it is inferred from these controls and Linear's closing-word list, since Linear exposes no parse log.
- `alliance_<name>_test` passes 63 bytes when `<name>` passes 49 characters.
- `scripts/rm-worktree.sh` looks a worktree's branch up by its recorded name, and returns without acting when that name no longer exists.

## Not verified

- Whether pushing a branch with a key moves an issue's status.
- Whether a key only in the branch name completes an issue at merge.
- Whether, in this workspace, `linear issue` completes an issue or a closing word reaches later keys in a list; both rest on Linear's docs alone.
