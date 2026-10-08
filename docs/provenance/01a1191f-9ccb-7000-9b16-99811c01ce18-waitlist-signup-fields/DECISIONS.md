# Decisions

- The public form stops sending `reason`. The column and the optional API field stay, so existing entries and the admin reason view are unchanged. The service and `CHK_waitlist_entry_reason` stop requiring a reason when the entry has no organization; otherwise those signups fail.
- The commitment checkbox only blocked submit in the browser. The request already always sent `committed: true`, which the API requires. The form keeps sending that flag.
