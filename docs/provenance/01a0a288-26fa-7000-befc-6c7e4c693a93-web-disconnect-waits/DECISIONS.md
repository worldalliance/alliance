# Decisions

## One disconnect at a time across the rows

`OAuthAccountLinks` holds the in-flight disconnect as the provider being disconnected, and every Disconnect is disabled while it is set. The server already refuses the second of two overlapping disconnects that would leave no way in ("Keep one way in when two disconnects overlap"), so this only keeps a passwordless member from seeing that refusal. Only the row being disconnected says "Disconnecting...".

Connect stays per row. A pending connect can't take away a way in.

## Reload the member when the tab comes back, only while a disconnect waits on a password

The notice tells the member to set a password through the reset link, which opens from an email, usually in another tab. While any row is the last way in, `OAuthAccountLinks` listens for `visibilitychange` and calls `refreshUser` when the page becomes visible. Nothing listens otherwise, so members with nothing held back don't fetch `/auth/me` each time they switch tabs.

`refreshUser` keeps the member it has when `/auth/me` fails. On a lapsed session the fetch wrapper's `auth:unauthorized` sends the member to sign in, as it does for any other request.

Rejected: showing copy that asks the member to reload after setting a password. The page would still refuse until they did.
