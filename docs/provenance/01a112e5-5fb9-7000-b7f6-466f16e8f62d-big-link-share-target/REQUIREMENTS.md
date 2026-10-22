---
user: Alex Dorey
task: Big Link Block linking to an external share target with a per-member code
---

Work towards phasing out the form builder's "Custom Component" field by letting the "Big Link Block" link to an external site, such as a Qualtrics survey, with a unique code per member appended.

External links are defined as external share targets at `/share-targets` (base URL + query parameter name). The user confirmed `/share-targets`, not `/share-links`, is the page meant.

Codes must not carry the `share-` prefix.

When no signed-in member is viewing (a guest viewing the form, an admin viewing responses, the HTML export), the block links to the target's base URL with no code.

Remove the uncommitted "External Link" custom component built earlier in the session; the Big Link Block replaces it.

A `#` icon was requested as a sixth option in the Big Link Block's "Icon:" picker (which has five today). After the agent reported that installed mobile builds crash on an icon they do not know, the user chose: skip the `#` icon for now; build the share-target link and a fallback for unknown icons now.

Asked what a share-target block should store in `url` (which older app builds link to), the user chose the agent's recommended option: the target's base URL, so older apps open the survey without a code.

Render the link as a big clickable button with an "arrow up-right" icon implying it is a link, and do not show the URL.
