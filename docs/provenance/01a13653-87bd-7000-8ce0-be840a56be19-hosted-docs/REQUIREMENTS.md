---
user: Alex Dorey
task: Admins upload documents under a unique ID, served publicly at a concise link like thealliance.org/docs/2026-DemocraticGrantMakingPilot.pdf
---

## Requirements

### Core

- Admins upload a document and assign it a unique ID. (user-originated)
- Each document is publicly reachable at `/docs/<id>`, e.g. `thealliance.org/docs/2026-DemocraticGrantMakingPilot.pdf`. (user-originated)
- Managed from the admin panel only. Any admin (`user.admin`) may create, replace, and delete documents. No frontend or mobile UI, no public index of documents, no expiry dates, no access control on the public link. (agent-proposed, user-approved)

### ID

- The admin types the ID. The form prefills it from the uploaded file's name, and the admin can edit it before saving. (agent-proposed, user-approved)
- The ID ends in the file's extension, `.pdf`. The part before it is letters, digits, `-`, and `_` only, at most 100 characters; no spaces, dots, or slashes. (agent-proposed, user-approved)
- IDs are unique case-insensitively among documents that are not deleted. (agent-proposed, user-approved)
- The ID cannot be changed after creation; to change it, delete the document and create a new one. (agent-proposed, user-approved)

### Files

- PDF only, validated by MIME type and file content (magic bytes). (agent-proposed, user-approved)
- Maximum file size 50 MB. (agent-proposed, user-approved)
- An admin can replace the file behind an existing document; the same URL then serves the new file. The previous file is not kept. (agent-proposed, user-approved)
- Replacing a file keeps the view count. (agent-proposed, user-approved)

### Deletion

- Deleting is a soft delete: the document's link stops resolving and returns 404, and the stored file is kept. A new document may then take the same ID. (agent-proposed, user-approved)

### Public serving

- The file is streamed through the API from storage, so the browser stays on our domain. (agent-proposed, user-approved)
- `/docs/<id>` works on both thealliance.org and worldalliance.org. (agent-proposed, user-approved)
- A request whose ID differs from a document's ID only by letter case gets a 301 redirect to the canonical casing the admin typed. (agent-proposed, user-approved)
- Served inline (`Content-Disposition: inline`, filename = the ID), so it opens in the browser's PDF viewer. (agent-proposed, user-approved)
- HTTP Range requests are supported and answered with 206 partial content. (agent-proposed, user-approved)
- `Cache-Control: public, max-age=300` with an `ETag`, so a replacement is visible within five minutes. (agent-proposed, user-approved)
- Search engines may index documents; no `X-Robots-Tag`. (agent-proposed, user-approved)
- A missing or deleted ID returns a plain 404 from the API, not the frontend's not-found page. (agent-proposed, user-approved)

### Admin panel

- The document list shows, for each document: ID, view count, an internal title/notes field visible only to admins, which admin uploaded it and when, which admin last replaced the file and when, and a button that copies the full public URL. (agent-proposed, user-approved)
- The copied URL uses thealliance.org: `https://thealliance.org/docs/<id>`. (agent-proposed, user-approved)

### Views

- A view is counted for each request with no `Range` header or with a `Range` starting at byte 0. No deduplication by visitor. (agent-proposed, user-approved)
