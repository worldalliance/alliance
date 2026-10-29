#!/usr/bin/env bash
# A stamp names a process by pid and start time, so a live process can be told
# apart from an unrelated one that reused a dead process's pid.
#
# Linux procps derives ps's start time from a boot time that shifts as NTP
# adjusts the clock, so there the stamp uses the start in ticks since boot from
# /proc, with the boot id. macOS stores a fixed start time, which ps formats in
# the caller's locale and time zone, so both are pinned for runs in different
# environments to agree.
#
# A zombie has no stamp: it has exited, and only its parent has yet to reap it.

process_stamp() {
  local start state
  if [[ -r "/proc/$1/stat" ]]; then
    # comm, the second field, can hold spaces and parentheses, so fields are
    # counted from the last ')': state is the 1st after it, starttime the 20th.
    start="$(awk '{ sub(/^.*\) /, ""); if ($1 == "Z") exit 1; print $20 }' "/proc/$1/stat" 2>/dev/null)" &&
      start="$start $(cat /proc/sys/kernel/random/boot_id 2>/dev/null)" || return 1
  else
    start="$(LC_ALL=C TZ=UTC0 ps -o stat=,lstart= -p "$1" 2>/dev/null)" || return 1
    read -r state start <<<"$start"
    [[ "$state" != Z* ]] || return 1
  fi
  [[ -n "${start// /}" ]] || return 1
  echo "$1 $start"
}

stamp_alive() {
  local now
  now="$(process_stamp "${1%% *}")" && [[ "$now" == "$1" ]]
}
