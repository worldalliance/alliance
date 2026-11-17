# Evidence

## Experiments

- **psql reads a variable set on stdin inside an included file**, 2026-11-16, psql 18.3 (Homebrew) against a local Postgres: `psql -X -v ON_ERROR_STOP=1 --single-transaction -At -f -` fed `\set password_hash '<synthetic bcrypt hash>'` and `\i '<file>'`, where the file runs `select :'password_hash'`, printed the hash unchanged, `$` signs included.
- **curl takes its URL from `--config -`**, 2026-11-16, curl on macOS: `curl --config - -w '%{url_effective}' <<<'url = "http://127.0.0.1:9/hc/fail"'` reported that URL as the one it tried.
