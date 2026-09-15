---
user: Charles Lien
task: Scope of the OAuth handover work on branch `oauth`
---

- ALL-1074 doesn't need to be handled. An agent filed it as "Old owner keeps their session after an OAuth handover and can take the account back": after `authenticate()` hands an unconfirmed account to whoever proved the address, the previous registrant keeps their session and any provider they connected, and can use them to disconnect the new owner's provider.
