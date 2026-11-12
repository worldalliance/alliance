# Decisions

The user asked for ALL-2139 as filed and was not asked about each of its points. The issue's points come from `01a1ccef-8e76-75bb-9655-d39c48ef9c28-finish-thealliance-move` (its `DECISIONS.md`) and are recorded here as that source's proposals, followed in full unless an entry below says otherwise.

- The admin deploy's certificate check moves to `deploy/nginx/check-cert.sh`, so the frontend deploy runs the same rule rather than a copy. It reports every missing name, and its printed certbot command names every name it was given, because certbot's `-d` list replaces a lineage's names (certbot user guide, "Changing a Certificate's Domains", from memory, not re-checked). (agent decision, from the round-3 review)
