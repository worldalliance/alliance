---
user: Charles Lien
task: Build the time zone picker's list from an authoritative source instead of a hardcoded one
---

- Asked why the picker uses a hardcoded time zone list, and to use an authoritative source instead if one exists. Also asked what browsers and mobile platforms use.
- Replace the earlier fix for ALL-1064 (a hand-added "Indian Standard Time" search term on the Asia/Kolkata row) with this: "reset --hard main and then do that instead". "That" is the agent's recommendation: build the rows from tzdata via `countries-and-timezones`, map old zone names to current ones, and search and label rows by country name.
- Rows: chose "Every zone". The agent's option described it as all current IANA zones from `countries-and-timezones`, searchable and sorted by offset, with no curation.
- Country adjectives in search ("indian", "japanese"; Linear ALL-1093): chose "Separate change". ALL-1093 stays out of this change.
- Display and select time zones the "standard" way.
- After a review of the ranked picker, said the change looked overengineered, and that regressions are fine as long as members get a good experience.
- Said "yes" to the agent's proposal to simplify: every zone sorted by offset, labeled with Intl's name, the city, and the zone's countries, searchable by city, country, zone id and old zone names, with no ranking tiers except one rule (a whole-word match on the row's own city or principal country comes first). Then said "yes" to having the agent test it and rewrite the commit around it. The agent had said this rule would not put Shanghai first for "china".
- Asked for a review of the branch, then to fix all the issues it raised, each in the commit that introduced it. The issues are the reviewing agent's findings, not the user's.
