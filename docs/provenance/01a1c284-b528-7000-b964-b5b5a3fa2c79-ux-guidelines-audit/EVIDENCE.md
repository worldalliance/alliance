All sources were opened on 2026-11-09 unless noted. Status per root `AGENTS.md` **Established practice**: formal standard (F), vendor recommendation (V), research-backed practice (R, or R* for an article naming no study), common practice (C).

## Question

What is the industry standard for UI and UX, what does the `ux-guidelines` checklist lack against it, and how much should be added?

## 1. Standards landscape

- No law opened requires more than WCAG 2.2 AA. ADA Title II uses WCAG 2.1 AA, with compliance dates of 26 April 2027 and 26 April 2028 after the April 2026 rule ([ADA.gov](https://www.ada.gov/resources/2024-03-08-web-rule/), [Federal Register](https://www.federalregister.gov/documents/2026/04/20/2026-07663/extension-of-compliance-dates-for-nondiscrimination-on-the-basis-of-disability-accessibility-of-web), F). Section 508 uses WCAG 2.0 AA ([Access Board](https://www.access-board.gov/ict/), F). The European Accessibility Act has applied since 28 June 2025, exempting microenterprises ([EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32019L0882), F). Whether each binds the Alliance was not determined.
- WCAG 2.2 equals ISO/IEC 40500:2025 ([W3C](https://www.w3.org/WAI/standards-guidelines/wcag/), F). [WCAG2ICT](https://www.w3.org/TR/wcag2ict-22/) applies it to non-web software and is informative. Its note on 1.4.12 lists HTML in Electron applications as markup used inside software.
- WCAG 3 is an incomplete draft and W3C advises meeting 2.2 ([W3C](https://www.w3.org/WAI/WCAG3), [draft](https://www.w3.org/TR/wcag-3.0/), F). Its contrast algorithm is undecided, so APCA isn't adopted.
- WebAIM's 2026 automated scan found 95.9% of home pages fail, with six error types making up 96% of errors ([WebAIM](https://webaim.org/projects/million/), R).

Not opened: ISO's own pages (403), the EN 301 549 text.

## 2. WCAG 2.2 coverage and accuracy of the checklist

Of 55 Level A and AA criteria, read from [WCAG 2.2](https://www.w3.org/TR/WCAG22/), the checklist before this change covered 21, partly covered 7, and omitted 27. Which of those an agent is likely to violate is judgement. The accuracy audit compared each item with its file in `sources/`. It found native apps labelled formal, unsupported claims on lines covering consistent behaviour, dragging, input format, shortcuts and keyboard or safe areas, and smaller extrapolations.

## 3. Design systems

Topics opened across Material, Apple, Fluent, Carbon, Polaris, Atlassian, GOV.UK and USWDS. At least four cover tokens, toast versus inline messages, tables, button hierarchy, disabled states and pagination. Convergent values, all C: 4 px spacing steps ([Fluent](https://fluent2.microsoft.design/layout), [Carbon](https://carbondesignsystem.com/elements/spacing/overview/), [Atlassian](https://atlassian.design/foundations/spacing); [GOV.UK](https://design-system.service.gov.uk/styles/spacing/) uses 5 px), no more than about 75 characters per line ([GOV.UK](https://design-system.service.gov.uk/styles/layout/); [USWDS](https://designsystem.digital.gov/components/typography/) gives 45 to 90, with a target of 66), hover or press at 50 to 150 ms and transitions at 150 to 400 ms ([Atlassian](https://atlassian.design/foundations/motion), [Carbon](https://carbondesignsystem.com/elements/motion/overview/)).

Disagreements: Shneiderman's [rule 5](https://www.cs.umd.edu/~ben/goldenrules.html) favours greying out invalid actions against GOV.UK and Atlassian. Apple prefers autosave while Shopify rejects it for admin forms. GOV.UK validates on submit where others also validate on leaving. Carbon [allows informational toasts](https://carbondesignsystem.com/patterns/notification-pattern/), so toasts aren't limited to confirmations. [Atlassian's accent role](https://atlassian.design/foundations/color) offers red and green for uses with no meaning tied to them, such as categories, while [Apple](https://developer.apple.com/design/human-interface-guidelines/color) says to avoid using one colour to mean different things. Apple withholds the primary role from a [destructive button](https://developer.apple.com/design/human-interface-guidelines/buttons), while Carbon gives a [destructive step that is the workflow's main action](https://carbondesignsystem.com/components/button/usage/) the primary danger style. [Cloudscape](https://cloudscape.design/patterns/general/timestamps/) always includes the UTC offset on an absolute timestamp, while [GitLab](https://design.gitlab.com/content/date-and-time) localises dates and appends the timezone where its context matters.

Material 3 and Polaris sites wouldn't render; Material comes from Google's `material-components-android` docs.

## 4. Color and vision

- Color vision deficiency affects about 8% of men of European ancestry ([Birch 2012](https://doi.org/10.1364/JOSAA.29.000313), R) and, in a pooled global estimate for children, 4.38% of boys and 0.64% of girls ([Jeong 2025](https://doi.org/10.1016/j.ophtha.2025.07.031), R); both read as abstracts.
- WCAG 1.4.1 and 1.4.11 are the operative requirements (F). Automated tools can't judge whether hue alone carries meaning. Coverage figures are [Deque's own 57.38%](https://www.deque.com/automated-accessibility-coverage-report/) of issues (C) and the best tool at 40% of planted barriers in a [GDS test](https://alphagov.github.io/accessibility-tool-audit/) (C).
- Rainbow colour maps distort data and exclude readers with color vision deficiency ([Crameri 2020](https://www.nature.com/articles/s41467-020-19160-7), R).

## 5. Rule review

A 65-rule brainstorm was checked against sources, labelled backed, contradicted or silent. Rules whose sources are linked from the checklist are the backed survivors. Strong agreement: switch versus checkbox (five sources), validation timing (four). Contradicted: consuming an outside click on a popover ([Apple](https://developer.apple.com/design/human-interface-guidelines/popovers), V). Many pages were read by keyword extraction, so "silent" there means the terms were absent from the pages searched.

## 6. Instruction length and adherence

- Anthropic advises under 200 lines per CLAUDE.md, where longer files "reduce adherence" ([memory docs](https://code.claude.com/docs/en/memory), V), and under 500 lines per SKILL.md ([best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices), V). After compaction only the first 5,000 tokens of a skill are re-attached ([skills](https://code.claude.com/docs/en/skills), V).
- Codex documents a 32 KiB default limit on AGENTS.md discovery, a loading limit ([OpenAI](https://developers.openai.com/codex/guides/agents-md), V).
- All-instructions accuracy degrades up to ten simultaneous instructions on 2024 and 2025 models ([Harada et al.](https://aclanthology.org/2025.findings-emnlp.896.pdf), R). IFScale found model-dependent degradation across keyword-inclusion instructions ([preprint](https://arxiv.org/html/2507.11538v1), R). Gloaguen et al. found context files well followed at over 20% more cost, with length not significant ([preprint](https://arxiv.org/html/2602.11988), R).
- For people, NASA fieldwork supports grouping long checklists by task ([Degani and Wiener](https://ntrs.nasa.gov/citations/19910017830), R).

No opened study tests conditional rules in a file like this one, so none sets a line limit for it.

## 7. Adopting rules on existing code

- WAI advises phasing by date and prioritising significant barriers ([policy guidance](https://www.w3.org/WAI/planning/org-policies/), [implementation](https://www.w3.org/WAI/planning-and-managing/implement/), V).
- [ESLint bulk suppressions](https://eslint.org/docs/latest/use/suppressions) enforce a rule on new code and baseline existing failures (V).
- Design systems separate text and button roles from the brand colour ([Atlassian](https://atlassian.design/components/tokens/all-tokens), [Carbon](https://carbondesignsystem.com/elements/color/tokens/), [USWDS](https://designsystem.digital.gov/design-tokens/color/overview/), C).

## Measurements of this repository

Method: text searches and reading of sources at commit 65f4984d18, on 2026-11-09, with no app run. Counts are grep approximations. The audit found rules broken for color-only meaning, contrast, failure feedback and native modal handling (`onRequestClose` missing in 2 of 7 `apps/mobile` files with a `Modal`); the defects are tracked in Linear ALL-2092 to ALL-2100 and ALL-2102. Native large text is an unconfirmed risk: `apps/mobile` overrides no font scaling, and the audit counted 40 `numberOfLines` uses and about 111 fixed-height matches in `apps/mobile/components`, none run at a large size.

React Native's autofill mapping, read on 2026-11-09 from `Libraries/Components/TextInput/TextInput.js` in the installed react-native 0.86.3, with no app run: when `textContentType` is unset on iOS, `TextInput` looks it up from `autoComplete`, and the map holds `name`, `email`, `tel`, `street-address` and `postal-code`.

## Licences of the newly copied pages

Checked on 2026-11-09 from each page's footer or named repository licence. Copied whole: W3C WAI pages under the W3C Document License, GOV.UK under the Open Government Licence v3.0, and USWDS, whose site repository states CC0 or public domain, with Android, Material, React Native, Chrome, PostHog, GitLab and Nature Communications under the licences their files record. The MIT grants of PostHog ([LICENSE](https://github.com/PostHog/posthog.com/blob/master/LICENSE)) and design.gitlab.com ([LICENSE](https://gitlab.com/gitlab-org/gitlab-services/design.gitlab.com/-/blob/main/LICENSE)) require the copyright and permission notice in all copies or substantial portions, and [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0) section 4(a) requires giving recipients a copy of the licence (licence texts; material-components-android has no NOTICE file). Held as excerpts: Apple, IBM Carbon, Atlassian, Microsoft Fluent, Nielsen Norman Group, Baymard, A List Apart, Shopify, Google Play, Tailwind, AWS Cloudscape, Progress Kendo, MUI and the UK Government Analysis Function, whose pages forbid copying or state no licence; and WCAG2ICT, COGA and the WHATWG input section, whose licences would allow more but which are too large. Each file records its notice.
