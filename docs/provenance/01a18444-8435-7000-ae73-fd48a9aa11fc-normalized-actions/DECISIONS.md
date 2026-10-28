# Decisions

- Use Redux Toolkit for the action pilot. Its entity adapter provides an established normalized store; TanStack DB remains a beta alternative. This is an agent selection, not a user requirement for Redux throughout the repository.
- Normalize the complete member/public action responses used by the shared web/mobile hooks. Keep admin, feed summaries, and historical representations separate until their field authority is defined. Identical IDs alone do not make those payloads interchangeable. The member list endpoint does not load `authors`, `project`, `suite`, or `updates`, so those fields come from the newest detail response while the rest come from the newest response of either kind.
- Scope the store to a QueryClient and clear it at session boundaries. Action DTOs include viewer permissions, progress, and assigned forms.
- Query caches retain IDs and list order; components obtain action records from Redux. Query lifecycle metadata remains in TanStack.
- Action queries share an invalidation prefix so writes affecting server-computed fields refresh details as well as list membership. Unread general updates retain their existing membership in that prefix.
- Reuse actionUtils for viewer-state patches and writesDuringLoads for confirmed writes during requests. Both list and detail loads participate in the same action write stream. Request start order decides between successful overlapping loads; aborted loads and prior-session work cannot populate the store.
