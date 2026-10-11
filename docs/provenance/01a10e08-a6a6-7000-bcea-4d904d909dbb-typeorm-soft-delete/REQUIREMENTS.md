---
user: "[redacted]"
task: "Specify migration of application deletions to TypeORM soft deletion"
date: 2026-10-05
---

# User requests

- R1. Convert every table's permanent deletion to TypeORM soft deletion, including entities beyond the existing custom soft deletes. Identify entities that should be exceptions.
- R2. Preserve behavior for members and admins. Filtering bugs may need fixing; ask about behavior changes rather than treating every existing omission as intentional.
- R3. Restoration happens through the database for now. Add no restoration UI or API and no message deletion endpoint.
- R4. Add no purge of retained records.
- R5. Load staging data into a local database and inspect it to inform the message deletion decision.

# Approved agent proposals

The behaviors below originated in agent recommendations. The user approved them during the interview; approval does not make the proposals human-authored.

- R6. Preserve historical invitation creation/signup totals, referral references, and group assignment references when an invitation is deleted. Active invitation lists and invitation use exclude deleted records.
- R7. Reject editing, liking, or pinning deleted forum content with 404, and remove corresponding controls from deleted-comment placeholders.
- R8. Keep replying to deleted-comment placeholders possible. Fix the failure that can occur after a reply is saved, and omit the notification to the deleted parent's author.
- R9. Omit deleted comments' original text and attachments from member and admin API responses. Retain the originals in the database.
- R10. Use the migration time as the deletion marker for previously deleted posts/comments whose old boolean provides no actual deletion timestamp.
- R11. Keep existing permanent cleanup for expired token/browser records and disposable AI results, recent searches, and recomputed clusters. Leave migration bookkeeping and unused legacy tables unchanged. These are exceptions to R1 and R4.
- R12. Physically unlink simple join-table rows when removing likes, memberships, or tag assignments. Soft-delete richer relationship records, including friendships and conversation participants.
- R13. Retain deleted accounts' profile, contact, and authentication fields in the database for manual restoration. Make the deleted account inaccessible.
- R14. Permanently invalidate an account's existing sessions when it is deleted, including after a later database restoration. A restored account must sign in again.
- R15. Retain a deleted video's storage files. Deleted videos remain unavailable through the video API.
- R16. Hide messages marked deleted from member/admin conversation lists, previews, reply quotes, and unread counts. Add no deletion endpoint.
- R17. Preserve existing cascade effects, deletion restrictions, and the ability to reuse deleted names/emails.
- R18. Route uploaded-video playback through the API in the web/mobile players, including saved direct storage URLs for those uploads. Previously copied direct storage URLs may remain accessible; blocking direct storage access is outside this migration.

# Deliverable

The user invoked the spec workflow, which produced the specification and provenance documents.

# Implementation request

- R19. Implement the feature this specification describes. The agent may change DECISIONS.md freely.
