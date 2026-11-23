# Decisions

- `SCHEMA_VERSION` goes from 4 to 5 with no reader for version 4, so a saved v4 export no longer loads and the tool throws for it. The user did not say whether any reviewer has saved progress that must survive; the previous bump, 3 to 4 in #1051, did the same. Old age and children's age bands cannot be mapped to the new ones, so a v4 reader would have had to re-ask the profile anyway. (agent decision)
- The country list is the 249 ISO 3166-1 alpha-2 codes, kept in `kora-review/src/countries.ts`, with English names from `Intl.DisplayNames` at runtime, sorted by name. kora-review has no runtime dependencies, and every browser it runs in has `Intl.DisplayNames`. The codes came from `countries-and-timezones` (248 codes) plus Bouvet Island (`BV`), which that package omits. (agent decision)
- The age, country, education, income and English questions are dropdowns; the rest are radio buttons, as before. "Prefer not to say" is the last option in each. (agent decision)
- The child AI-use question reads "Do your children use AI chatbots?" because a parent may have several children; the spec lists it as "child uses AI chatbots". (agent decision)
- An answer to a follow-up that is hidden again (US region after the country changes, the children's questions after the parent answer changes) is saved as null. (agent decision)
- The server no longer redacts the profile: every profile answer is now an enum the schema validates before redaction runs, so it holds no free text. (agent decision)
- The server's KORA export (`server/src/kora/kora-spec-export.ts`) still leaves reviewers' demographics null; filling them from the profile is separate work. (agent decision)
