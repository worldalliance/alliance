# Evidence

## Rate-limiting SMS verification codes

Question: what limits do standards and vendors set on sending SMS one-time codes, per number, per account or per IP, and how do they keep one user from using up another's? Researched by a subagent on 2026-11-22.

- NIST SP 800-63B-4 §3.2.2 limits failed attempts per account and says a new secret does not reset that count; it sets no limit on sends, and treats codes that confirm an address as outside authentication (formal standard): <https://pages.nist.gov/800-63-4/sp800-63b.html>
- OWASP ASVS 5.0.0 V6.6.2 and V6.6.3: out-of-band codes are bound to the request that produced them and are rate limited, with no key named for the limit; V6.1.1 requires controls against malicious account lockout (formal standard, community): <https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md>
- OWASP MFA Cheat Sheet, SMS: "enforce per-account rate limits", and warns of attackers requesting many messages to exhaust funds (common practice): <https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html>
- Twilio Verify rate limits list user IP, phone number and session as keys to limit on (vendor recommendation): <https://www.twilio.com/docs/verify/api/programmable-rate-limits>
- Twilio's toll-fraud guide recommends layered limits per user, IP or device, bot detection, and turning off countries you don't serve (vendor recommendation): <https://www.twilio.com/docs/verify/preventing-toll-fraud>
- No source found addresses one user exhausting another user's per-number limit; binding codes and limits to the account follows from the account-binding rules above (agent judgement).

## Production phone numbers

Method: read-only session (`default_transaction_read_only=on`) on the production database through `scripts/with_db_env.sh production` on the production host, 2026-11-22, against live (`deletedAt IS NULL`) rows of `user`.

- Numbers held by more than one live account: 0.
- Live accounts with a number saved: 456.
- Live accounts with a verified number (`phoneNumberVerifiedAt` set): 0.
