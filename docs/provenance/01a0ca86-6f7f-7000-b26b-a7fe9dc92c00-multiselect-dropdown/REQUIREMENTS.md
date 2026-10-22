---
user: Charles Lien
task: Multiselect dropdown display option
---

## User requirements

- Add an option to display a multiselect form field as a dropdown, with selected options displayed underneath.
- Support web, mobile, and admin previews.
- Support searching, off by default. The admin UI offers three choices: Checkboxes, Dropdown, and Searchable dropdown. Store the configuration as two booleans with Zod validation.
- Record the accepted recommendations about chips, open-menu behavior, trigger and empty-state text, and selected-option ordering in DECISIONS.md rather than REQUIREMENTS.md.
- This task produces a spec; implementation waits for a user request.

## Approvals of agent proposals

- Approved configuring the display per field, with checkboxes remaining the default for existing and new fields.
- Approved retaining selection limits and validation, disabling unselected options at the limit while allowing removal, omitting Select all and Clear all, and showing read-only selections without removal controls.
- Approved the agent's boolean mapping and rejection of search without dropdown mode, with omitted flags treated as false and mode changes preserving answers and other field settings. See DECISIONS.md for the mapping.
- Approved the agent's proposed search matching, query lifecycle, and visibility of selected options during filtering. See DECISIONS.md for those behaviors.
- Approved fixing an agent's review finding: a restored answer can still hold multiselect values for options an admin has since removed. The plain dropdown kept those values while the searchable dropdown dropped them on the next change, and in every mode they counted toward the selection limit without being shown.

## Later requirements (Alex Dorey)

- The mobile multiselect sheet has a close button in its top-right corner.
