#!/bin/sh

# Prints the commit immediately after <commit-ish> on the path to HEAD, which is
# the first commit a branch adds on top of the ref it was taken from.
#
# Usage: scripts/commit-after.sh <commit-ish>
#
# Runs against the repository of the working directory, so run it inside the
# worktree you mean.

if [ "$#" -ne 1 ]; then
    echo "ERROR[usage]: expected exactly one commit-ish argument." >&2
    echo "usage: scripts/commit-after.sh <commit-ish>" >&2
    exit 2
fi

input=$1

if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "ERROR[not-a-repository]: must be run inside a Git repository." >&2
    exit 3
fi

commit=$(git rev-parse --verify --quiet --end-of-options "$input^{commit}") || {
    echo "ERROR[invalid-ref]: \"$input\" does not resolve to a commit." >&2
    exit 4
}

head=$(git rev-parse --verify HEAD) || {
    echo "ERROR[invalid-head]: HEAD does not resolve to a commit." >&2
    exit 3
}

if [ "$commit" = "$head" ]; then
    echo "ERROR[no-commit-after]: \"$input\" resolves to HEAD; there is no commit after it on the path to HEAD." >&2
    exit 5
fi

if ! git merge-base --is-ancestor "$commit" "$head"; then
    echo "ERROR[not-ancestor]: \"$input\" ($commit) is not an ancestor of HEAD; commit-after is undefined." >&2
    exit 6
fi

children=$(
    git rev-list --children "$head" |
    sed -n "s/^$commit //p"
)

set -- $children

case $# in
    1)
        printf '%s\n' "$1"
        ;;
    0)
        echo "ERROR[no-commit-after]: no child of \"$input\" leading to HEAD was found." >&2
        exit 7
        ;;
    *)
        echo "ERROR[ambiguous]: \"$input\" has multiple immediate child commits that lead to HEAD." >&2
        echo "There is no unique commit immediately after it." >&2
        echo "Candidates:" >&2

        for c in "$@"; do
            git show -s --format='  %H  %s' "$c" >&2
        done

        echo >&2
        echo "Clarification required: choose which history path/candidate you mean." >&2
        exit 8
        ;;
esac

