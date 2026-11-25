# Evidence

## Bun's `import.meta.dir` through a symlinked directory

Method: a file `real/a.ts` printing `import.meta.dir`, run as `bun link/a.ts` where `link` is a symlink to `real`. It printed the `real` path. Checked 2026-11-19 with Bun 1.4.4 on macOS. The worktree test fixtures symlink `scripts/` into a temporary main checkout, so a script locating its repository from `import.meta.dir` would find the real repository there.
