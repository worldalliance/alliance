import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const COMMIT = "c".repeat(40);
export const NEWER = "d".repeat(40);

// Stands in for gh: answers each call with API-shaped JSON built from
// $FAKE_DEPLOYMENTS ("id sha" lines) and $FAKE_STATES ("id state" lines, a
// deployment's newest state), $FAKE_COMPARE and $FAKE_TIP, then applies the
// call's --jq filter with jq. It keeps the posted deployment body and answers
// it with id 42. $FAKE_FAIL fails the call whose arguments contain it.
const FAKE_GH = `#!/usr/bin/env bash
echo "$*" >> "$FAKE_DIR/calls"
if [ -n "\${FAKE_FAIL:-}" ] && [[ "$*" == *"$FAKE_FAIL"* ]]; then echo "HTTP 502" >&2; exit 1; fi
filter=.
for ((i = 1; i < $#; i++)); do
  if [ "\${!i}" = --jq ]; then j=$((i + 1)); filter=\${!j}; fi
done
case "$*" in
  *"/deployments?"*)
    printf '%s\\n' "\${FAKE_DEPLOYMENTS:-}" \\
      | jq -nRc '[inputs | select(. != "") | split(" ") | {id: (.[0] | tonumber), sha: .[1]}]' ;;
  *"/statuses?per_page=1"*)
    id=\${2#*/deployments/}; id=\${id%%/*}
    printf '%s\\n' "\${FAKE_STATES:-}" \\
      | jq -nRc --arg id "$id" '[inputs | split(" ") | select(.[0] == $id) | {state: .[1]}]' ;;
  *"/compare/"*) jq -n --arg status "$FAKE_COMPARE" '{$status}' ;;
  *"/git/ref/heads/production"*) jq -n --arg sha "$FAKE_TIP" '{object: {$sha}}' ;;
  *"POST repos/o/r/deployments --input"*) cat > "$FAKE_DIR/body"; echo '{"id": 42}' ;;
esac | jq -r "$filter"
`;

export function makeFakeGhDir() {
  const dir = mkdtempSync(join(tmpdir(), "deploy-guard-"));
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  writeFileSync(join(dir, "calls"), "");
  return dir;
}

export function runScript(params: {
  dir: string;
  command: string[];
  env: Record<string, string>;
}) {
  const { dir, command, env } = params;
  const result = Bun.spawnSync(
    ["bash", `${import.meta.dir}/${command[0]}`, ...command.slice(1)],
    {
      env: {
        ...process.env,
        PATH: `${dir}:${process.env.PATH}`,
        FAKE_DIR: dir,
        GITHUB_REPOSITORY: "o/r",
        ...env,
      },
    },
  );
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    calls: readFileSync(join(dir, "calls"), "utf8"),
  };
}
