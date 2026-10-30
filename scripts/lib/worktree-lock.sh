#!/usr/bin/env bash
# Exclusive locks for the worktree scripts. The kernel releases a lock once
# every descriptor on it is closed, so a killed holder never leaves one held,
# but a child started while holding it holds it too: start long-lived children
# with N>&-. Callers pick the descriptor, since bash 3.2 cannot allocate one.
#
# A run that finds no lock file creates one and takes it uncontended, so never
# unlink or replace a lock file another run may open: retire it by renaming its
# directory away while holding it, and never recreate that directory.

# macOS ships no flock(1), but perl's flock works on both macOS and Linux. Exits
# 1 when another holder has the lock, 3 when the file locked is no longer the one
# at the path, and 4 on any other failure.
lock_fd() {
  perl -MFcntl=:flock -e '
    my ($fd, $nonblocking, $path) = @ARGV;
    open(my $f, ">&=", $fd) or do { warn "$!\n"; exit 4 };
    flock($f, LOCK_EX | ($nonblocking ? LOCK_NB : 0)) or do { exit 1 if $!{EWOULDBLOCK}; warn "$!\n"; exit 4 };
    my @held = stat($f);
    my @now = stat($path);
    exit(@now && $held[0] == $now[0] && $held[1] == $now[1] ? 0 : 3);
  ' "$1" "$2" "$3"
}

# A directory that cannot be stat'ed for a reason other than ENOENT is not gone.
dir_gone() { perl -e 'exit(!(!stat($ARGV[0]) && $!{ENOENT}))' "$1"; }

# Returns 1 when the lock's directory is gone, or was removed while waiting: what
# the lock guarded went with it. Returns 2 when the lock cannot be opened or
# taken, or its file was removed or replaced while waiting. A failure once the
# lock file is open closes the descriptor.
acquire_lock() {
  local lock="$1" what="$2" fd="$3" status=0 cause
  until { eval "exec $fd>>\"\$lock\""; } 2>/dev/null; do
    dir_gone "$(dirname "$lock")" && return 1
    # Reopened in a subshell to capture the cause; success means it cleared.
    cause="$( (eval "exec $fd>>\"\$lock\"") 2>&1 )" && continue
    echo "error: could not open $lock: ${cause##*: }" >&2
    return 2
  done
  cause="$(lock_fd "$fd" nonblocking "$lock" 2>&1)" || status=$?
  if (( status == 1 )); then
    echo "==> waiting for another run to release $what ('lsof \"$lock\"' lists the holder among every waiter, this run's pid $$ included)" >&2
    status=0
    cause="$(lock_fd "$fd" "" "$lock" 2>&1)" || status=$?
  fi
  case "$status" in
    0) return 0 ;;
    3)
      release_lock "$fd"
      dir_gone "$(dirname "$lock")" && return 1
      echo "error: $lock was removed or replaced while waiting for it" >&2
      return 2
      ;;
    *) echo "error: could not lock $lock${cause:+: $cause}" >&2; release_lock "$fd"; return 2 ;;
  esac
}

release_lock() { eval "exec $1>&-"; }
