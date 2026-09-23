# Each revert undoes the one before it, and git titles a revert of a revert "Reapply", so an odd count leaves the tz data declined.
def unrevert: if startswith("Revert \"") then .[8:] | unrevert | .depth += 1 elif startswith("Reapply \"") then .[9:] | unrevert | .depth += 2 else {depth: 0, rest: .} end;
[.commits[].messageHeadline | unrevert | select(.rest | startswith(env.HEADLINE)) | .depth] as $depths
| if ($depths | last // 0) % 2 == 1
# bump-formatjs.sh runs this only when the checkout lacks the tz data, so a merged pull request that named it dropped it.
  or (.state == "MERGED" and ([.body, .commits[].messageHeadline] | any(contains(env.AFTER))))
# A body proposing a bump, in tzdb-release-watch.yaml's wording, names the tz data its commit carried, so one no headline carries was force-pushed away.
# A body saying another pull request declined the tz data names it too, without proposing it.
  or (($depths | length) == 0 and (.body | contains("Its own commit bumps it") and contains(env.AFTER)))
  then 1 else 0 end
