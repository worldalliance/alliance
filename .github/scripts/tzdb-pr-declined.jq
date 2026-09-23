# Each revert undoes the one before it, and git titles a revert of a revert "Reapply", so an odd count leaves the tz data declined.
def unrevert: if startswith("Revert \"") then .[8:] | unrevert | .depth += 1 elif startswith("Reapply \"") then .[9:] | unrevert | .depth += 2 else {depth: 0, rest: .} end;
([.commits[].messageHeadline | unrevert | select(.rest | startswith(env.HEADLINE)) | .depth] | last // 0) % 2
# bump-formatjs.sh runs this only when the checkout lacks the tz data, so a merged pull request that named it dropped it.
+ (if .state == "MERGED" and ([.body, .commits[].messageHeadline] | any(contains(env.AFTER))) then 1 else 0 end)
