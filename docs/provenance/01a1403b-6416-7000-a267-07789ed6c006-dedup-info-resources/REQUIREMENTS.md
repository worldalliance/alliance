---
user: Charles Lien
task: One source of truth for the Information page's contact and resource entries on web and mobile
---

Origin: user

Deduplicate by likely future change, not by lines deleted: code that should change together lives in one place, so a future change has a single source of truth and behavior cannot diverge. Land the item as one standalone commit.

Origin: agent-proposed, user-approved

The web Information page (`apps/frontend/src/pages/app/InformationPage.tsx`) and the mobile Information screen (`apps/mobile/app/(app)/information.tsx`) render their contact and resource entries from one list in `shared/lib`. That list holds each entry's id, title, description, link (mailto for contacts, site path for resources), the feature flag gating it, and the order.

Icons and rendering stay per platform. Each platform maps entry ids to icons with a type that fails the build until a new entry has an icon.

Where the two copies' wording differs, the more recent intended copy, found through git history, wins. The mobile link to the renamed ambassadors page (`/ambassador-program`, now `/ambassadors`) is fixed as a result.

"General updates" no longer sits at a hardcoded index on mobile; its position comes from the shared order.
