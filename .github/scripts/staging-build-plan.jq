# Input: {fingerprints: `fingerprint.mjs print` output, platforms:
#   "both"|"ios"|"android", force, latest: "<platform>: <fingerprint>" lines
#   naming each platform's most recently submitted fingerprint, otherJobs:
#   [{name, status, conclusion, newer} of every job in this workflow's other
#   queued or in-progress runs, newer when that run's commit descends from
#   this run's]}
# Output: the build job's matrix include list. Each entry's name is its job's
#   name, which otherJobs matches against.
def by_platform: split("\n") | map(select(. != "") | split(": ") | {(.[0]): .[1]}) | add // {};
{
  ios: {runner: "macos-26", timeout: 60, artifact: "ipa"},
  android: {runner: "ubuntu-latest", timeout: 45, artifact: "aab"}
} as $targets
| (.fingerprints | by_platform) as $fingerprints
| (.latest | by_platform) as $latest
# A succeeded build still counts, since its run's tag job waits for every platform.
| [.otherJobs[] | select(.status != "completed" or .conclusion == "success")] as $active
| . as $in
| [
    $targets | to_entries[]
    | select($in.platforms == "both" or $in.platforms == .key)
    | {platform: .key, fingerprint: $fingerprints[.key]} + .value
    | if (.fingerprint // "") == "" then error("no \(.platform) fingerprint") end
    | .name = "Build \(.platform) \(.fingerprint)"
    | select(.name as $job | $active | any(.name == $job) | not)
    | ("Build \(.platform) " as $prefix | $active | map(select(.name | startswith($prefix)))) as $platformJobs
    # Superseding a newer commit's build would ship the older fingerprint over it.
    | select($platformJobs | any(.newer) | not)
    # A running build of another fingerprint would leave testers on it unless this one supersedes it.
    | select($in.force or $latest[.platform] != .fingerprint or ($platformJobs | length > 0))
  ]
