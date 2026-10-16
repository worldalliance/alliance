# Decisions

- The fix is splitting `responsesHtmlExport.ts` along cohesive boundaries until every resulting file is well under the 500-line limit, with no behavior change. The rendered HTML stays byte-identical, so the existing `responsesHtmlExport.test.ts` covers the refactor unchanged.
- The orchestrating agent picked this waiver so parallel agents work on non-overlapping files; it gave no other rationale.
- Split layout, from the options `codex exec` proposed per the repo's file-size rule: `responsesHtmlExport.ts` stays the public entry point (its importers don't change) and keeps snapshot grouping, variants, metadata and document assembly. Helpers move into `responsesHtmlExport/`:
  - `xml.ts`: escaping and tag construction, used by every other part.
  - `schema.ts`: stored-schema parsing and rendering of what respondents saw.
  - `responses.ts`: answer, respondent and response rendering.
  - `assets.ts`: the embedded CSS and browser script, which are plain strings with no TypeScript dependencies.
- Each extraction is its own commit so each passes typecheck and tests on its own; the waiver goes in the commit that brings the file under the limit.
