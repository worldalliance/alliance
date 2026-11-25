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
