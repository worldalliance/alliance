# Decisions

- A content read skips its count refetch while a read or read-all that lowered the count is pending (`countDownPending` on the notification store), since a refetch then reads a server count that does not yet reflect that write, undoing its decrement (or, through cancelling a first count load in flight, dropping its replayed decrement), and the pending write refetches the count when it settles. Agent decision, from review of ALL-1943's fix.
