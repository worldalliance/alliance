## Measurements

Checked 2026-11-10 on macOS 27.0 (arm64), Bun 1.4.4.

- A directory holding only one of `m.TEST.ts`, `Foo.Spec.ts`, `m_Test.ts`, `m.test.TS`, `m.test.Tsx`: `bun test` runs 1 test in each, so the suffix and the extension both match regardless of case.

## Bun source

Checked 2026-11-10 at tag `bun-v1.4.4` (38afee6c84).

- [`src/runtime/cli/test/Scanner.rs`](https://github.com/oven-sh/bun/blob/bun-v1.4.4/src/runtime/cli/test/Scanner.rs): `next` passes `entry.base_lowercase()` to `could_be_test_file`, which checks the extension's loader and the suffixes `.test`, `_test`, `.spec`, `_spec`. Vendor source.
- [`src/resolver/fs.rs`](https://github.com/oven-sh/bun/blob/bun-v1.4.4/src/resolver/fs.rs): every directory entry's `base_lowercase_` comes from `strings::copy_lowercase_if_needed`, with no platform branch, so the matching is case-insensitive on Linux too. Vendor source.
