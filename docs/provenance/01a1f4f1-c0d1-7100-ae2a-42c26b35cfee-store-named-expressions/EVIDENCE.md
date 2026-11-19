# Evidence

Research by Claude subagents on 2026-11-19, by web search. A claim marked *(search summary)* rests on a search result, not an opened page. Status labels follow root `AGENTS.md` **Established practice**.

## Storing versions

Question: how do products store reusable rule definitions that consumers pin?

- Camunda 8 lets a process bind to a decision as `latest`, `deployment` or `versionTag`, and says `latest` "might not be suited for production environments that require stability" while `versionTag` suits "external or shared dependencies". Vendor recommendation. https://docs.camunda.io/docs/components/best-practices/modeling/choosing-the-resource-binding-type/
- Drools/KIE rules ship as kjars with a Maven `ReleaseId` (groupId:artifactId:version). Vendor documentation. https://docs.jboss.org/drools/release/8.27.0.Beta/kie-api-javadoc/org/kie/api/builder/ReleaseId.html
- dbt model versions mark breaking changes, with a `deprecation_date` on old versions. Vendor documentation. https://docs.getdbt.com/docs/mesh/govern/model-versions
- Fowler: an audit log is the simplest record of history; a temporal property suits history that queries need. Common practice (expert writing). https://martinfowler.com/eaaDev/timeNarrative.html
- PostgreSQL 18 implements application-time `WITHOUT OVERLAPS` / `PERIOD` constraints, not SQL:2011 system versioning. Common practice (secondary source). https://lord.technology/2025/01/28/understanding-temporal-primary-keys.html
- Agent judgement from these: where consumers pin versions, the shared pattern is an immutable row or artifact per version; no source showed time-travel queries on a definition table.

## Blocking deletes

- LaunchDarkly: "You cannot delete a segment if one or more flags is using it." Vendor documentation. https://launchdarkly.com/docs/home/flags/segment-management
- Unleash: "You can only delete a segment that isn't in use", with a **Used in** list. Vendor documentation. https://docs.getunleash.io/concepts/segments
- Postgres refuses to drop objects others depend on (`RESTRICT` by default) and names them in the error's DETAIL. Vendor documentation. https://www.postgresql.org/docs/18/ddl-depend.html
- Airtable leaves formulas broken when a field they read is deleted, and users have asked for a dependency checker. Common practice (community forum). https://community.airtable.com/legacy-product-ideas-75/product-suggestion-for-dealing-with-names-for-deleted-fields-in-formulas-41532

## Two admins at once

- RFC 9110 §13.1.1: `If-Match` on state-changing requests prevents "the lost update problem"; a failed precondition is 412. Formal standard, checked through secondary sources. https://www.rfc-editor.org/rfc/rfc9110#section-13.1.1
- Google AIP-154: resources carry an `etag` that changes with the resource; a mismatch returns `ABORTED` (HTTP 409). Vendor recommendation. https://google.aip.dev/154
- Kubernetes `resourceVersion` mismatches return 409 Conflict. Vendor documentation *(search summary)*. https://github.com/knodir/kubernetes/blob/master/docs/api-conventions.md

## Where re-validation runs

- Looker validates saved content against the model with its Content Validator and a CI Content Validator on pull requests, and advises fixing broken content close to the LookML deploy. Vendor recommendation. https://docs.cloud.google.com/looker/docs/content-validation · https://docs.cloud.google.com/looker/docs/ci-content-validator
- dbt validates in CI against project state (`dbt parse`, `dbt sl validate`). Vendor documentation. https://docs.getdbt.com/best-practices/how-we-mesh/mesh-6-coordinate-versions

## Names

Question: what do products call these concepts?

- One named thing covering yes/no conditions and computed values: FHIR SDC's `variable` extension, referenced as `%name` (formal standard, https://hl7.org/fhir/uv/sdc/STU3/expressions.html); Google Sheets "Named functions" (vendor documentation, https://support.google.com/docs/answer/12504534); Excel `LAMBDA` saved in Name Manager (vendor documentation, https://support.microsoft.com/en-us/office/lambda-function-bd212d27-1cd1-4321-a34a-ccbf254b8b67).
- No study tests labels such as "variable", "condition" or "formula" with admins. Trigger-action wording studies exist (Ur et al., CHI 2014, https://www.blaseur.com/papers/TriggerActionCHI14.pdf, *search summary*), and NN/g's heuristic of matching users' own words is expert guidance, not a study (https://www.nngroup.com/articles/match-system-real-world/).

## The admin panel's existing words

Measured by the naming brainstormer, reading `apps/admin/src` at commit d0523eed87 on 2026-11-19: the old form builder's "Variables" tab (`FormBuilderHeader.tsx`, `VariableBuilder.tsx`) holds per-form named computed values; "Formula" names an options source (`OptionsSourcePicker.tsx`); "Groups" already has four meanings (community groups, visibility groups, reminder groups, participating groups); "Segment" has no admin-facing use.
