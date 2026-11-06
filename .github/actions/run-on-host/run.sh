#!/usr/bin/env bash
# See action.yml. Expects DEPLOY_ARTIFACTS_BUCKET and <ENV>_INSTANCE_ID from
# .github/ci.env, and AWS credentials for the environment's CI role.
set -euo pipefail

case "$ENVIRONMENT" in
  staging) instance=$STAGING_INSTANCE_ID ;;
  production) instance=$PRODUCTION_INSTANCE_ID ;;
  *) echo "::error::unknown environment: $ENVIRONMENT" >&2; exit 1 ;;
esac
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

bucket=$DEPLOY_ARTIFACTS_BUCKET
prefix="$ENVIRONMENT/$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT/$GITHUB_JOB/$(basename "$work")"
if [ "$TIMEOUT_MINUTES" -lt 1 ]; then
  echo "::error::timeout-minutes must be at least 1; timeout treats 0 as no limit" >&2
  exit 1
fi
dupes=$(while IFS= read -r file; do [ -z "$file" ] || basename "$file"; done <<<"$FILES" | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "::error::files share a base name, so one would overwrite another in ~/: $dupes" >&2
  exit 1
fi
timeout=$((TIMEOUT_MINUTES * 60))
# A timed-out script gets SIGTERM, then this long to recover before timeout
# SIGKILLs it.
recovery=900
# A cancelled job's script keeps running; the next run's same job waits for it,
# and for its downloads before it.
lock_wait=$((timeout + recovery + 120))
execution_timeout=$((lock_wait + timeout + recovery + 60))
delivery=600
# Delivery, then the command up to its timeout; the margin covers the agent
# uploading output.
max_wait=$((delivery + execution_timeout + 120))
# Ten minutes of the session go to the uploads before the wait and the output
# download after it.
if [ $((max_wait + 600)) -gt "$ROLE_DURATION_SECONDS" ]; then
  echo "::error::timeout-minutes $TIMEOUT_MINUTES makes the wait outlast the hosts role's 3-hour session" >&2
  exit 1
fi

# Without a trap, the script's shell would die at SIGTERM before the command
# it is running finishes recovering.
{ echo "trap 'exit 143' TERM"; printf '%s\n' "$SCRIPT"; } > "$work/script.sh"
aws s3 cp --only-show-errors "$work/script.sh" "s3://$bucket/$prefix/script.sh"
while IFS= read -r file; do
  [ -n "$file" ] || continue
  aws s3 cp --only-show-errors "$file" "s3://$bucket/$prefix/files/$(basename "$file")"
done <<<"$FILES"

sent=$(date +%s)
# Run Command starts this as root; the script runs as ec2-user in a login
# shell, so ~ and the pm2 daemon are ec2-user's.
host_command=$(cat <<HOST
exec 2>&1
set -eu
queue=/run/lock/run-on-host-$GITHUB_JOB.queue
echo "$sent $GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" >> "\$queue"
# sudo closes fd 9, so a daemon the script starts doesn't keep holding the lock.
exec 9>/run/lock/run-on-host-$GITHUB_JOB
flock -w $lock_wait 9 || { echo "an earlier $GITHUB_JOB is still running on this host"; exit 1; }
# flock wakes waiters in no set order, and an agent back online runs the
# commands it missed in parallel, so the queue orders them by when they were
# sent. A later one means this one's job was cancelled, and its files are older.
newer=\$(awk '\$1 > $sent { print \$2; exit }' "\$queue")
[ -z "\$newer" ] || { echo "run \$newer sent its $GITHUB_JOB after this one; not deploying older files over it"; exit 1; }
step=\$(sudo -u ec2-user mktemp)
sudo -iu ec2-user aws s3 cp --region us-west-2 --only-show-errors --recursive "s3://$bucket/$prefix/files/" /home/ec2-user/
sudo -iu ec2-user aws s3 cp --region us-west-2 --only-show-errors "s3://$bucket/$prefix/script.sh" "\$step"
log=\$(mktemp /tmp/run-on-host-$GITHUB_JOB.XXXXXX)
code=0
# timeout puts the script in a process group of its own, which the agent's
# SIGKILL of a cancelled or timed-out command doesn't reach. The script writes
# to a file because the agent closes its pipe on cancel, and the script's next
# write would die of SIGPIPE. exec keeps the login shell from staying between
# timeout and the script without the script's trap, as a trap in ec2-user's
# dotfiles would make it.
timeout -s TERM -k $recovery $timeout sudo -iu ec2-user exec bash "\$step" >"\$log" 2>&1 || code=\$?
cat "\$log"
rm -f "\$step" "\$log"
exit "\$code"
HOST
)

command_id=$(aws ssm send-command \
  --instance-ids "$instance" \
  --document-name AWS-RunShellScript \
  --comment "$GITHUB_JOB run $GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT" \
  --timeout-seconds "$delivery" \
  --parameters "$(jq -n --arg c "$host_command" --arg t "$execution_timeout" '{commands: [$c], executionTimeout: [$t]}')" \
  --output-s3-bucket-name "$bucket" \
  --output-s3-key-prefix "$prefix/output" \
  --query Command.CommandId --output text)
echo "Run Command $command_id on $instance"

deadline=$((SECONDS + ${MAX_WAIT_SECONDS:-$max_wait}))
status=Pending
running=true
invocation='{}'
while [ "$SECONDS" -lt "$deadline" ]; do
  sleep "${POLL_SECONDS:-5}"
  if ! invocation=$(aws ssm get-command-invocation --command-id "$command_id" --instance-id "$instance" --output json 2>"$work/error"); then
    # Right after send-command, the invocation may not exist yet.
    grep -q InvocationDoesNotExist "$work/error" || { cat "$work/error" >&2; exit 1; }
    invocation='{}'
    continue
  fi
  status=$(jq -r .Status <<<"$invocation")
  case "$status" in
    Pending | InProgress | Delayed | Cancelling) ;;
    *) running=false; break ;;
  esac
done

mkdir "$work/output"
aws s3 cp --only-show-errors --recursive "s3://$bucket/$prefix/output/$command_id/" "$work/output/" || true
if find "$work/output" -type f -name stdout | grep -q .; then
  find "$work/output" -type f -name stdout -exec cat {} +
else
  echo "(no full output in S3; Run Command's first 24000 characters follow)"
  jq -r '.StandardOutputContent // ""' <<<"$invocation"
fi

if $running; then
  echo "::error::Run Command $command_id still $status on the host after the wait deadline" >&2
  exit 1
fi
if [ "$status" != Success ]; then
  details=$(jq -r '"\(.StatusDetails // "none"), exit \(.ResponseCode // "none")"' <<<"$invocation")
  echo "::error::Run Command $command_id ended $status ($details)" >&2
  exit 1
fi
