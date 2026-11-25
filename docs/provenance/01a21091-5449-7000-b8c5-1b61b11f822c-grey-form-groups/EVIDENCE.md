# Evidence

Researched by a subagent on 2026-11-24.

## Grouping semantics

- WCAG 2.2 SC 1.3.1 (Info and Relationships) requires relationships shown visually, including form fields presented as a group, to be programmatically determinable or stated in text; techniques H71 (fieldset/legend) and ARIA17 (grouping roles). Formal standard. https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html
- W3C WAI's forms tutorial defaults to fieldset/legend, treats `role="group"` with `aria-labelledby` as equivalent, and advises short legends because some screen readers repeat them per control. Vendor recommendation. https://www.w3.org/WAI/tutorials/forms/grouping/
- GOV.UK Design System uses a fieldset when showing a relationship between several inputs, with the legend as its first child. Vendor recommendation. https://design-system.service.gov.uk/components/fieldset/

## Contrast on `#f4f4f5` (Tailwind zinc-100)

Computed with the WCAG relative-luminance formula.

| Foreground | On #f4f4f5 | On white | Requirement |
|---|---|---|---|
| zinc-500 #71717a | 4.40:1 | 4.83:1 | 4.5:1 normal text (SC 1.4.3) |
| zinc-300 #d4d4d8 border | 1.35:1 | 1.48:1 | 3:1 where it is the control's only boundary (SC 1.4.11) |
| white input fill | 1.10:1 | n/a | 3:1 if it is the only indicator |

- SC 1.4.11 measures a control's boundary against adjacent colours, so inside the box that is `#f4f4f5`. Formal standard. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

## Nesting and modelling

- NN/g: a common region is a strong grouping cue; avoid decorative boxes. Research-backed guidance. https://www.nngroup.com/articles/common-region/
- Design systems discourage cards inside cards, e.g. Trimble Modus https://modus.trimble.com/components/mobile/cards and Equinor EDS https://eds.equinor.com/docs/components/surfaces/card. Vendor recommendation.
- Typeform (`group` field with child fields, https://www.typeform.com/developers/create/reference/create-form/), SurveyJS (panels, https://surveyjs.io/form-library/documentation/api-reference/panel-model) and Notion (callout children, https://developers.notion.com/reference/block) model groups as containers; Tally links flat blocks by a shared `groupUuid` (https://developers.tally.so/api-reference/endpoint/forms/post). Common practice.

## Inputs on a tinted surface

Researched by a subagent on 2026-11-24.

- WCAG 2.2 SC 1.4.11 requires 3:1 for visual information needed to identify a control; a boundary is needed only when nothing else identifies the control, and "Text inputs that have no border and are differentiated only by a background color must have a 3:1 contrast ratio to the adjacent background." Formal standard. https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- SC 1.4.3 sets 4.5:1 for normal text; zinc-600 `#52525b` is about 7:1 on `#f4f4f5`. Formal standard. https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- GOV.UK uses one near-black input border on every surface and thickened it to meet 1.4.11. Vendor recommendation. https://design-system.service.gov.uk/styles/colour/ and https://github.com/alphagov/govuk-frontend/issues/1820
- Carbon swaps field and border tokens per layer (`$field-02` on `$layer-01`, paired `$border-strong-02`) but keeps text tokens the same on every layer. Vendor recommendation. https://carbondesignsystem.com/elements/color/tokens
- Primer sets control borders at the scale step that reaches minimum contrast against `bgColor-muted`, a tinted surface. Vendor recommendation. https://primer.style/foundations/color/base-scales
- None of the systems checked prescribes darkening text tokens on tinted containers.

## Measurements

- **zod 4.3.6 refuses `.omit()` on a refined object schema.** Calling `.omit({ b: true })` on `z.strictObject({...}).superRefine(...)` throws ".omit() cannot be used on object schemas containing refinements". Method: a script run with bun on 2026-11-24.
