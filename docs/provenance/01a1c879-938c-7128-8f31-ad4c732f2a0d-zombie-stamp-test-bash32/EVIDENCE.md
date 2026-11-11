## Measurements

Checked 2026-11-10 on macOS 27.0 (arm64), Bun 1.4.4, /bin/bash 3.2.57, at `origin/main` b0baa42d5f.

- Looping `cd scripts && bun test` 15 times: "a zombie has no stamp" timed out at 5000ms in every run that finished. Run on its own, the file also fails that test. Some runs went past a 10 minute watchdog, but the machine's load average was 100–680 from unrelated simulators and emulators, and the captured process tree showed the suite still spawning children. So those runs don't show a hang.
- The test's bash script, run through `spawnSync` outside bun test: exit status 1 and empty stdout, as the test expects, after 10.1s.
- Process tree 1.5s in: the outer bash had exited, and a `bash -c` subshell reparented to pid 1 remained as the parent of `sleep 10`, whose stderr was /dev/null. That subshell is the process substitution's fork, which bash 3.2 does not replace with `sh`.
- After `exec sh -c …` in the process substitution: the test file runs in 0.75–0.91s, 8/8 pass, three runs. With `process_stamp`'s zombie check disabled, the test fails in 0.6s.
