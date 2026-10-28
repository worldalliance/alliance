# Wiki implementation decisions

These are agent-authored implementation choices supporting [the requirements](./REQUIREMENTS.md). They may be revised within those requirements.

## Files and navigation

Use `docs/wiki/` for topic pages, `docs/wiki/index.md` for navigation, and `docs/wiki/coverage.md` as the provenance ledger during the initial build. Markdown remains the editable source. Derived navigation, backlinks, and search data are disposable build or runtime artifacts; introduce no database entity or migration.

Use level-two headings in the index for topic groups and ordinary relative Markdown links with short descriptions for their pages. Parse this same index for the sidebar and home page. Keep the initial hierarchy one group deep. A topic may be linked from multiple groups when useful without duplicating its content.

Use ordinary Markdown headings, links, lists, tables, and fenced code blocks. Topic files have descriptive, stable filenames and start with a title and explanation of behavior. Include exceptions and platform differences when they affect that explanation. Place citations near the rules they support; add a short source section when it makes the implementation easier to locate. Link tests that actually exist and identify untested behavior honestly.

Derive backlinks from links between wiki pages. The sidebar, table of contents, backlinks, and local link validator share the same heading-ID and path-resolution rules. Preserve published paths and heading IDs when reorganizing pages so existing links remain useful. Provenance links resolve inside the viewer; repository code links resolve to GitHub at the served documentation revision.

The ledger is a single table with one row per provenance directory. Prettier skips it, because aligning the table rewrites every row whenever its widest cell changes and parallel batches would conflict. After the initial build, each record's coverage moves into a `wiki` key in the frontmatter of its `REQUIREMENTS.md`, or of its `DECISIONS.md` for the directories without one, and the ledger is deleted. One row per record would otherwise grow without bound, at roughly 45 records a month. The viewer derives the coverage index from that frontmatter, using the same corpus parser as the check. Keep the metadata readable Markdown frontmatter rather than adding a separate database or hand-maintained JSON copy.

## Evidence and initial synthesis

Inventory the provenance corpus at implementation time, including requirements, decisions, and evidence files. The interview inventory contained 236 directories and approximately 228,000 words; these numbers describe scale and are not fixed completion targets. Include new records present by handoff, including this feature's own provenance.

Group sources by behavior, trace the current implementation and tests, and write synthesized topic pages in batches. Examine each record's substantive claims, not only its filename or summary. Routine refactor narration can be accounted for without reproducing it in a topic page. Preserve useful architectural facts when they help explain current behavior.

Give each source directory a coverage entry linking its relevant documents, affected wiki pages, and any supporting disposition evidence. Distinguish current material, explicitly superseded material, clearly unimplemented work, implementation-only records, topics blocked on clarification, and records pending synthesis. Mixed records can link to several topics and explain the portions that have different dispositions. A blocked entry records progress but does not satisfy initial content completion.

A newer timestamp alone does not establish supersession. Use an explicit later requirement or other direct evidence. A code discrepancy alone does not establish that an old requirement was abandoned. Gather the conflicting passages and code evidence, ask for the user's decision, and continue unrelated topics without publishing an asserted resolution for the blocked topic.

For otherwise unknown origins, follow git blame through moves or refactors to the relevant introducing change, then inspect commit messages and available linked PR context. Cite the commit and label the attribution or inferred rationale as git-derived. A commit author identifies Git attribution, not necessarily who conceived or approved a requirement; this matters in a repository primarily edited by agents. Explicit requests found through that history can supply stronger evidence. If history remains inconclusive, retain the uncertainty.

Keep three claims distinguishable: observed implementation, explicit requirements, and inferred intent. The wiki can describe behavior demonstrated by code without manufacturing an approved requirement. Git-derived rationale belongs in linked provenance or a clearly attributed evidence note rather than being asserted as human intent in topic prose.

## Serving the deployed corpus

Use the existing NestJS API and `AdminGuard` for read-only documentation endpoints. Package an allowlisted wiki/provenance corpus and its source revision with the backend release; the current backend archive omits `docs/`, so deployment packaging must change. Serve the revision belonging to those files and use it for GitHub citations. Admin navigation obtains that revision from the documentation API, including during staggered frontend/backend deployment, rather than guessing from the frontend version.

Resolve requests against the corpus's known document IDs. Do not turn a client-supplied path into unrestricted filesystem access. Apply admin authentication to catalog, document, and search-data responses, and avoid shared public caches for them. The public GitHub repository is a separate access path permitted by the requirements.

Produce catalog entries and the link graph with a maintained Markdown parser. Reuse the repository's Markdown rendering dependencies and URL-safety handling, adapting wiki links and heading anchors for this reader. Render text and supported Markdown rather than executing embedded HTML, scripts, or MDX. Existing hosted documents are public PDFs and are not the storage or serving path for this wiki.

Use the working tree as the document source during local development so agent edits appear without a production deployment. Label it as a local working copy rather than presenting a commit as proof of uncommitted content. Production packages are validated before release; malformed or missing required documents fail the documentation build instead of silently disappearing from navigation or coverage.

## Reader and search behavior

Add a Wiki entry to the existing admin navigation with dedicated routes for wiki pages and provenance files. Keep the implementation in admin and the supporting API; it adds no member-facing web or mobile feature.

Use a collapsible topic sidebar at narrow widths, a main reading column, and a table of contents for the current document. Backlinks identify referring wiki pages. Show the served revision and link it to the repository. Direct page/section URLs work after reload.

Provide explicit loading, retryable error, missing-page, and empty-search states. An expired session follows the existing authentication flow. Broken internal document references remain visible as unavailable references instead of silently navigating to unrelated content. Reuse existing UI controls and keyboard/focus conventions.

Implement case-insensitive full-text search with page titles and excerpts. Default to wiki content; the include-provenance control broadens the corpus and labels result types clearly. Keep the query and inclusion choice in the URL so a search can be shared and restored with browser navigation. Fetch search data through authenticated endpoints and keep indexes in application memory.

Prefer an existing or small maintained text-search library if it simplifies matching. Title weighting, optional aliases/keywords in page frontmatter, and typo tolerance are discretionary enhancements. Avoid mandatory tagging work, embeddings, generated answers, external model calls, and a persisted search entity. Any accepted metadata must remain agent-editable in the Markdown and be understood by the same corpus parser.

## Agent workflow and checks

Add a concise root `AGENTS.md` pointer directing agents to the wiki index for repository behavior questions and relevant changes. Put the maintenance procedure in a wiki skill, and connect it to the implementation and review workflows. The manual audit uses the same rules. Read the index and relevant pages, then follow their evidence links before making changes; the wiki accelerates discovery without replacing source inspection.

Update affected topic pages, citations, navigation, and coverage within the same change. Refactors may only require repairing implementation links. A new provenance record gets a coverage entry even when it is a specification with no current implementation. Until the user judges that the first content batches give agents enough pages to model new ones on, that entry starts `pending` unless the change updates a page explaining it, and a new concept waits for a content batch instead of getting a page in the feature change, which would otherwise write it with no example to follow. Add a topic page when there is a distinct current concept to explain; keep existing explanations current instead of appending task histories.

During audits, compare explanations with their sources, repair verified documentation and structural errors, and report those edits. Escalate conflicts between requirements and code before revising the affected topic. The audit does not independently change application behavior or rewrite requirements to agree with code.

Update the provenance skill so future `DECISIONS.md` files are optional when there is no useful rationale to preserve. Keep requirements self-contained and retain the distinction between user-originated requirements, approved agent proposals, and agent inferences. Existing provenance is not reformatted as part of this feature.

Add `bun run wikicheck` and invoke it from CI on every pull request. It does not gate deploys: records reach main from branches cut before their coverage row was required, and a missing row should not block shipping a fix. Validate wiki/index/coverage structure, local file and fragment targets, source citations, and the presence of coverage for every provenance directory in the current tree. Reuse the same parser and resolver as the viewer. Include fixtures proving broken targets, missing fragments, and missing coverage fail. Check local targets deterministically; external websites are not fetched during CI.

Validate links authored in the new wiki and coverage files. Existing provenance documents remain readable without turning all of their historical links into a migration prerequisite; unavailable legacy references can be reported by the audit. Structural checks cannot prove that a page accurately represents every source, so the content review must inspect each coverage entry and its topic explanation.

## Implementation validation

- Verify authenticated access with admin, non-admin, and anonymous API tests, including direct document and search-data requests and invalid document paths.
- Exercise parser/link resolution, heading anchors, index-derived navigation, backlinks, coverage failures, basic search, and optional provenance search with focused tests using synthetic Markdown fixtures.
- Verify the admin reader in the browser: direct links and reloads, cross-page and provenance navigation, GitHub revision links, search inclusion, empty/error states, keyboard navigation, and narrow-screen layout. Follow the repository's browser-verification skill.
- Check a packaged release independently of the source checkout so missing documentation or incorrect revision stamping is caught. Confirm the deployed viewer reads the packaged corpus and that rollback selects the corresponding content.
- Review every initial coverage entry against the original records and current code. Resolve blocked topics with the user before claiming the initial corpus is complete.
- Run package typechecks, focused tests, `bun run dupcheck`, and `bun run covercheck` for implementation logic; check formatting. Run `actionlint` for workflow changes and the prescribed shell checks if deployment scripts change. Regenerate API clients through the existing workflow when endpoints are introduced.

## Delivery

Ship the feature as separate PRs grouped by the review each needs: factual review of content against code, security and deployment review of serving, and browser verification of the reader. One combined PR would bury the factual review, which no structural check replaces.

A `pending` coverage disposition lets the corpus land in batches. `wikicheck` accepts it structurally, as it accepts `blocked`; neither counts toward initial content completion. The initial content pass is complete when no entry is `pending` or `blocked`.

1. **Foundation.** The shared Markdown corpus parser and link resolver, `wikicheck` with its failure fixtures and CI wiring, the root `AGENTS.md` pointer, the wiki skill and audit, the provenance skill change, `docs/wiki/index.md`, and `docs/wiki/coverage.md` listing every provenance directory as `pending`. Every later PR depends on this one.
2. **Content batches**, one PR per topic group. Each writes or updates its topic pages and index entries and moves its coverage entries from `pending` to a final disposition or `blocked`. Batches are independent, so a topic awaiting the user's resolution holds back only its own batch. Each batch's review checks its entries against the original records and current code.
3. **Serving.** The `AdminGuard`-protected catalog, document, and search-data endpoints; the working-tree source for local development; allowlisted corpus packaging and revision stamping in the backend release; regenerated API clients; and the access tests for admin, non-admin, anonymous, and invalid-path requests. Depends on 1.
4. **Admin reader.** The Wiki navigation entry, page and provenance routes, sidebar, table of contents, backlinks, revision display, GitHub citation links, search with the provenance option, and the loading, error, missing-page, and empty-search states. Depends on 1 and 3.
5. **Coverage migration**, after the last content batch. Moves each ledger row into its record's frontmatter, deletes `coverage.md`, removes the `pending` disposition so a new record states its real disposition in the change that adds it, switches `wikicheck` and the wiki skill to the frontmatter, and has the viewer derive the coverage index from it. Depends on 2 and 4.

Content batches can proceed alongside 3 and 4. The packaged-release check in implementation validation runs once 3 and 4 have landed.
