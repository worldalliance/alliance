---
user: Charles Lien
task: Specify an agent-maintained Markdown wiki with provenance and an admin reader
---

## User-origin requirements

- Store the wiki as linked Markdown files in the repository. It serves both humans and agents; almost all repository changes are made by agents, so discovery, authoring, and upkeep must work through ordinary repository tools.
- Explain how the system works. Keep intent and rationale in provenance and reference them from the wiki where useful. Retain `REQUIREMENTS.md` records.
- Account for everything currently in provenance during the initial wiki build.
- The repository is open source. State this in the root agent instructions so agents encounter that fact routinely.
- Use git blame as a proxy for otherwise unknown provenance.
- Enhanced search is optional. Prefer whatever is simple to implement and maintain, especially an approach requiring no new database entity. Tags are a possible aid rather than a required feature.

## Approved agent proposals

These selections were proposed by the agent and approved by the user.

### Content and initial coverage

- The first implementation includes the Markdown wiki, an agent maintenance workflow, and a read-only admin viewer.
- Organize pages by topic and explain product behavior first. Include technical flows, exceptions, and source-code and test links where useful. Related topics link to each other across package boundaries.
- Process every existing provenance record, verify current behavior against code, and maintain a coverage index showing where each record was accounted for. Several records may contribute to one page, and one record may contribute to several pages.
- Read surrounding code as needed to explain a provenance-backed topic. The initial scope does not require discovering every unrelated feature without provenance.
- Clearly superseded requirements and specified-but-unimplemented features remain accounted for in the coverage index with links to their provenance. Topic pages describe current behavior; these records do not require historical or planned-feature pages. Refactors do not automatically require separate pages.
- Preserve existing provenance files during the initial build. Express supported relationships in the wiki and coverage index. Changes to existing provenance require the user's resolution of the relevant conflict.
- After the initial build, each provenance record carries its own coverage in its metadata, and the coverage index is derived from those records rather than maintained as one growing file. Migrating every existing record's coverage into its metadata is authorized as part of that change.
- When requirements and implementation disagree, pause the affected topic and ask the user to resolve the disagreement before documenting it. Continue independent topics. Uncertain claims of supersession or non-implementation require the same clarification.

### Maintenance and decisions

- Agents read and maintain the relevant wiki pages during every relevant code change. Include a manually invoked wiki audit; recurring scheduled audits are outside this scope.
- The audit corrects verified wiki errors, including stale source links and explanations inconsistent with code that still satisfies requirements. It reports its changes and pauses topics with requirements/code conflicts for the user's decision.
- Keep existing `DECISIONS.md` files. Future decision files are needed only for useful rationale or non-obvious choices; retain the requirements workflow for qualifying tasks.
- CI fails on broken wiki links and missing provenance coverage entries. Agents remain responsible for factual accuracy.

### Reader and access

- Add a wiki area to the admin panel. All existing admins can read it. Wiki and provenance content, including direct content and search requests, require admin authentication. The repository remains public; application authentication does not make repository documents confidential.
- Display documentation shipped with the environment's deployment and show its revision. Do not substitute the latest documentation on the default branch.
- Render wiki pages and provenance files inside the admin viewer. Source-code and test citations open GitHub.
- Provide a shallow grouped sidebar and a wiki home page, both driven by the Markdown index. Agents choose the actual groups from the documented topics.
- Include stable page and heading links, a page table of contents, backlinks, and full-text search. Search wiki pages by default and offer an option to include provenance.
- Run search within the application without an external search or AI service. Basic full-text search is required; aliases, keywords, ranking, and typo tolerance may be added where they remain simple. Their absence does not block completion.

## Acceptance criteria

- Every provenance record in the implementation checkout is represented in the coverage index with topic links or an evidenced explanation of its disposition. Relevant current behavior is synthesized into topic pages and checked against code; a ledger entry alone does not establish factual coverage.
- Paused topics and their unresolved questions are explicit. The initial content pass is incomplete while any topic is awaiting a required user resolution.
- A reader can navigate from the wiki home page to a topic, follow a heading link, view related topics and backlinks, and open its provenance in admin and source citations on GitHub.
- Search finds text in the wiki, distinguishes no matches from a loading failure, and includes provenance only when requested.
- Anonymous and non-admin requests cannot retrieve application-served wiki content or search data. Admins can read the same corpus through navigation and direct links.
- Staging and production each identify the documentation revision they serve. Redeployment and rollback carry the corresponding documentation with the application.
- Deliberately introducing a broken wiki link or omitting a provenance record from coverage causes the automated check to fail with an actionable location. A factual error is not considered detected merely because structural checks pass.
- Agent instructions identify how to find relevant pages, update them with code changes, account for new provenance, invoke the audit, and stop for an unresolved conflict.
