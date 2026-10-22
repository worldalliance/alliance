---
user: Charles Lien
task: Make links follow the domain the reader is on, worldalliance.org or thealliance.org
---

- Many pages hardcode `worldalliance.org`; the site has also been served on `thealliance.org` for a while. Links on worldalliance should go to worldalliance, and links on thealliance should go to thealliance.
- The other hosts follow the same rule, and so do their `thealliance.org` equivalents:
  - `staging.worldalliance.org` links to `staging.worldalliance.org`.
  - `admin.staging.worldalliance.org` links to `staging.worldalliance.org` or `admin.staging.worldalliance.org`.
  - `admin.worldalliance.org` links to `admin.worldalliance.org` or `worldalliance.org`.
- Asked whether `mailto:` addresses (contact@, support@, grant@worldalliance.org) should switch domain with the page, the user chose to leave the email addresses as they are.
- The user wants to hear about anything in the server that hardcodes a domain, since it may need handling differently.
