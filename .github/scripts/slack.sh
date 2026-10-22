# shellcheck shell=bash
# Sourced from a workflow `run:` block: . .github/scripts/slack.sh

# Slack parses <...> as a link or a mention, so text naming <Button> or
# carrying a <url|label> of its own renders as one.
slack_escape() {
  printf '%s' "$1" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g'
}

# Commit messages are multi-line; an alert gets the subject only.
slack_commit_subject() {
  slack_escape "${1%%$'\n'*}"
}

# --fail-with-body rather than --fail: Slack puts the reason it turned a
# payload down in the body, and --fail throws the body away.
slack_post_payload() {
  local webhook=$1
  if [ -z "$webhook" ]; then
    echo "No Slack webhook configured." >&2
    return 1
  fi
  curl -sS --fail-with-body --max-time 30 \
    --retry 3 --retry-max-time 60 --retry-connrefused \
    -X POST -H 'Content-type: application/json' --data @- "$webhook"
}

slack_post() {
  local webhook=$1 text=$2
  jq -n --arg text "$text" '{text: $text}' | slack_post_payload "$webhook"
}
