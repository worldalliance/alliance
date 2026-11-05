# Decisions

## Research behind the requirements

Each requirement's option was checked against published practice before the user chose it.

- Committed CA bundle: NIST SP 800-57 treats a trust anchor's public key as non-secret.

## Implementation

- **`DB_CA_CERT` stays exported under `BACKCOMPAT(ALL-1963)`**, read from the release's committed bundle, because a release from before the server read that bundle has no fallback for it. Origin: agent decision.
