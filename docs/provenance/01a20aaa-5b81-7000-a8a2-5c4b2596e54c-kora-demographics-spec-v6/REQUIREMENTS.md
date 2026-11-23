---
user: Alex Dorey
task: Rewrite the KORA demographics survey to reflect the options in the latest KORA_SPEC.md.
---

# Requirements

Supersedes `01a1e702-0454-7000-8909-7a36b31e1381-kora-parent-question-required`, whose required questions without "Prefer not to say" the spec now reverses.

- The KORA pre-survey asks KORA_SPEC.md section 5's demographic questions (spec commit `e5ed0ce`), in this order and with these answers (user-originated):
  - Age: 18 to 29 / 30 to 39 / 40 to 49 / 50 to 59 / 60 and over
  - Gender: Woman / Man / Other
  - Country, from a list; if the United States, region: Northeast / Midwest / South / West
  - Parent or guardian of a child under 18: Yes / No
  - If a parent, the children's ages, as checkboxes: Under 7 / 7 to 9 / 10 to 12 / 13 to 17
  - If a parent, whether their child uses AI chatbots: Never / Sometimes / Often / Don't know
  - Works professionally with children or in healthcare: Yes / No
  - Highest education: High school or less / Some college / Bachelor's degree / Graduate degree
  - Household income: Under $50,000 / $50,000 to $100,000 / $100,000 to $150,000 / Over $150,000
  - English fluency: Native or bilingual / Fluent / Comfortable / Basic
- Every question is optional, and every question except the children's ages offers "Prefer not to say"; a reviewer leaves the children's ages unticked instead. (user-originated)
- "Prefer not to say" is stored as `prefer_not_to_say` and a skipped question as null, so the two stay distinguishable. (user-originated)
- The pre-survey no longer asks how often the reviewer uses AI chatbots, which the spec doesn't list. (agent-proposed, user-approved)
- Answers are stored under the keys and values of KORA's export schema (`docs/kora/kora_export.schema.yaml`, `reviewer`), country as an ISO 3166-1 alpha-2 code. (agent-proposed, user-approved)
