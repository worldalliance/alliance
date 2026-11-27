# Evidence

Research and measurements behind the admin redesign: what established practice says about redesigning an internal admin tool from scratch, and what the repository's own admin looks like today.

## Research

All sources were checked on 2026-11-24 by a research subagent briefed with the situation below; first-person notes ("I read only the abstract") are its own. The Bun rewrite account in section 5 was read separately on the same date.

**Situation it was given.** A small organisation's staff run it through an internal admin web app of about 70 destinations (React 19, React Router 7, Tailwind CSS 4, TanStack Query and Table, a generated typed client for a NestJS server). The owner wants it modern-looking and frictionless, done as one pull request built by many AI agents in parallel within about 12 hours including review, with the member-facing web app unchanged. The admin imports UI primitives and a form renderer from packages it shares with the member-facing apps, and styles pages with ad-hoc Tailwind classes, with no admin design system.

**Questions.**

1. Information architecture and navigation for an internal tool with about 70 destinations used by a small staff: sidebar structure, grouping, command palette or global search, keyboard navigation, breadcrumbs, deep links.
2. The core page patterns of back-office tools and the evidence for each: data tables (filtering, sorting, bulk actions, saved views, pagination vs virtual scroll, density), list to detail (page vs drawer vs split view), long forms and editors, dashboards, inbox and queue views, feedback (toasts, optimistic updates, undo vs confirm), empty, loading and error states.
3. What makes an internal tool read as modern and feel frictionless: what leading products' published design systems prescribe on type, spacing, density, colour and dark mode, and motion; research on aesthetics and perceived usability, and on what slows expert users down.
4. The component foundation for React 19 and Tailwind CSS 4: which headless or styled libraries are maintained, their accessibility claims and what backs them, and whether admin frameworks fit an app with an existing typed API client and TanStack Query.
5. How to carry out a large UI redesign: full rewrite vs incremental, design-system-first, pull request size vs review effectiveness, visual regression testing, and published cases of large migrations or rewrites by AI coding agents.

**Status labels**, per source:

- **[standard]**: formal standard (W3C and similar bodies).
- **[vendor]**: official guidance from a platform, framework, library or design-system owner, including a vendor's account of its own work (vendor case study).
- **[research]**: a published empirical study, given with year, sample and peer-review status.
- **[common]**: common practice, including expert-practitioner guidance (for example NN/g articles that report no data).

**[judgement]** marks the researcher's own inference. Where a source was read only through abstracts or secondary summaries, the entry says so.

### 1. Information architecture and navigation (about 70 destinations, small expert staff)

#### Findings

- **WCAG 2.2, W3C Recommendation, 12 Dec 2024** [standard]. https://www.w3.org/TR/WCAG22/
  - **2.4.5 Multiple Ways (AA):** more than one way to reach a page. A sidebar plus search or a command palette satisfies it.
  - **2.4.7 Focus Visible (AA)** and **2.4.11 Focus Not Obscured (Minimum) (AA):** a focused element must not be fully hidden by author content, which matters for sticky headers, toasts and drawers.
  - **2.1.4 Character Key Shortcuts (A):** any single-character shortcut must be possible to turn off, remap to include a modifier, or be active only while its component has focus. This applies directly to Linear-style `g i` or `c` shortcuts.
  - I read the normative text of 2.4.5, 2.4.7, 2.4.11, 1.4.3 and 1.4.11 directly. 2.5.7, 2.5.8, 3.3.7 and 4.1.3 are cited from the same spec but fell outside the part I fetched.
- **WAI-ARIA Authoring Practices, Developing a Keyboard Interface** [vendor: W3C WAI note, not normative]. https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
  - A composite widget (menu, listbox, grid, tree) is one tab stop, and arrow keys move within it, using roving tabindex or `aria-activedescendant`.
  - Shortcuts must supplement navigation, not replace it.
  - Avoid key combinations that clash with the OS, assistive technology or browser: modifier plus Tab, Enter, Space or Esc; Meta plus a single key; Ctrl+Option on macOS; browser find, refresh and address bar.
  - Guidance on single-key shortcuts is marked "to be written".
- **NN/g, "Left-Side Vertical Navigation on Desktop"** [common]. https://www.nngroup.com/articles/vertical-nav/
  - Vertical left navigation suits "broad or growing IAs" with many top-level items.
  - Labels should be left-aligned, keyword-first and visible.
  - This is expert guidance, not a controlled study.
- **Atlassian navigation system** [vendor]. https://atlassian.design/components/navigation-system/migration-guide, https://www.atlassian.com/blog/design/designing-atlassians-new-navigation
  - Atlassian's 2025 redesign moved product navigation from the top bar to a resizable, collapsible, user-customisable **side nav** for app-specific destinations.
  - A thin **top nav** holds only global items: search, create, notifications, help, settings, profile.
  - The component pages are early access and internal to Atlassian. The structure is public.
- **Linear, "How we redesigned the Linear UI (part II)", 28 Mar 2024**, and **"Behind the latest design refresh", 12 Mar 2026** [vendor: a product team describing its own choices; not a published system]. https://linear.app/now/how-we-redesigned-the-linear-ui, https://linear.app/now/behind-the-latest-design-refresh
  - Aims: denser, better-ordered navigation and a **dimmer sidebar** so the work area dominates.
  - Removed decorative icon backgrounds. "Structure should be felt not seen."
- **NN/g, "Breadcrumbs: 11 Design Guidelines", 2018, reviewed Sep 2026** [common]. https://www.nngroup.com/articles/breadcrumbs/
  - Breadcrumbs pay off on deep hierarchies where people land mid-tree (for example from search). They are unnecessary for sites one or two levels deep.
  - Show the full trail on desktop.
  - No study data is reported.
- **GitHub Primer, Layout** [vendor]. https://primer.style/product/getting-started/foundations/layout/
  - Defines "split page" layouts for side navigation and list-detail, with the pane flush left.
  - Its "context region" should not be a full breadcrumb with dropdowns.
  - Breakpoints: 544, 768, 1012, 1280 and 1400 px. Content padding is 16 px, rising to 24 px at ≥1280 px.
- **NN/g, "UI Accelerators", 18 Oct 2024** [common]. https://www.nngroup.com/articles/ui-accelerators/
  - Shortcuts should be optional, aimed at frequent core actions, shown inline next to the action (for example in menus), and revealed gradually.
  - Don't override standard shortcuts. Give feedback and offer undo.
  - Grounded in heuristics and the power law of practice, with no new data.
- **Novice-to-expert transition research** [research].
  - **Scarr, Cockburn, Gutwin and Quinn, CHI 2011, "Dips and ceilings"** (peer-reviewed). https://researchr.org/publication/ScarrCGQ11. Users plateau on menu or mouse methods: switching to shortcuts causes a temporary performance dip, so they don't switch.
  - **Lane, Napier, Peres and Sándor, IJHCI 18(2), 2005** (peer-reviewed). https://dblp.dagstuhl.de/rec/journals/ijhci/LaneNPS05.html. Even experienced users often fail to move from menus and toolbars to faster keyboard shortcuts. I read only secondary summaries.
  - **Cockburn et al., ACM Computing Surveys 47(2), 2014** (peer-reviewed survey). https://doi.org/10.1145/2659796. A synthesis of methods that support the transition to expertise, such as showing the shortcut where the user already looks.
  - These support a command palette that **shows each command's shortcut next to it**. That design inference is [judgement]; that shortcuts are under-adopted unless surfaced is [research].
- **Command palette (Cmd/Ctrl+K)** [common]. No standard or controlled study was found. It is widespread in leading tools (Linear, GitHub, Vercel, Netlify, PostHog docs).
- **URL state and deep links: Vercel Web Interface Guidelines** [vendor]. https://vercel.com/design/guidelines
  - "Persist state in the URL so share, refresh, Back/Forward navigation work."
  - Deep-link "filters, tabs, pagination, expanded panels".
  - Restore scroll position on Back and Forward.

#### What this means for 70 destinations
No standard caps the number of sidebar items or sets a grouping depth. The common practice in the products above:
- Persistent left sidebar with about 6–10 labelled groups, each collapsible, holding the frequently used destinations.
- Global search or command palette that reaches **every** destination and common actions.
- A thin top bar, or none, for global items.
- Breadcrumbs only where the hierarchy is three or more levels deep, for example Action → tab → form.
- Every list filter, tab and selected record in the URL.

---

### 2. Core page patterns

#### Data tables

- **NN/g, "Data Tables: Four Major User Tasks", Apr 2022** [common]. https://www.nngroup.com/articles/data-tables/
  - The four tasks are find records, compare, view/edit/add one row, and take actions.
  - Put a human-readable identifier in the first column. Freeze header rows and columns on overflow.
  - Bulk actions use row checkboxes plus "Select all".
  - Show active filters clearly.
  - Column hide and reorder need a menu alternative to drag-and-drop.
  - Avoid modals for deep editing because they hide neighbouring rows.
  - Evidence is NN/g observation, with no sample reported.
- **IBM Carbon, Data table style/usage** [vendor]. https://carbondesignsystem.com/components/data-table/style
  - Row heights: xs 24, sm 32, **md 40 (default)**, lg 48, and xl for two-line rows.
  - Header row and pagination match the row height. A small toolbar goes with sm/xs rows.
- **Density** [common]. Carbon is the only system above that publishes numeric table densities. Primer and Linear speak of density only qualitatively. No research on optimal row height for expert back-office users was found.
- **Pagination vs infinite/virtual scroll: NN/g** [common]. https://www.nngroup.com/articles/infinite-scrolling-tips/
  - Infinite scroll is a poor fit for goal-oriented finding tasks. "Load more" is a middle ground.
  - Evidence is drawn mostly from e-commerce.
  - Nothing found is specific to back-office tables. Virtualisation (TanStack Virtual) is an implementation choice, not a UX standard [judgement].
- **Saved views:** no standard or study found. Common in Linear, Airtable, Notion and Jira [common]. Combine with URL state (above) so a view is a shareable link [judgement].
- **WCAG 2.5.7 Dragging Movements (AA)** [standard]. Drag-to-reorder (columns, the priority-ordering page, the form-builder canvas) needs a single-pointer non-drag alternative.

#### List to detail (page vs drawer vs split view)

- **Material 3 canonical layouts** [vendor]. https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts. List-detail shows both panes side by side at expanded widths and one at a time at narrower widths. A supporting pane takes about 30% of the width.
- **Primer split page** [vendor], above.
- **Stripe Apps design** [vendor]. https://docs.stripe.com/stripe-apps/design. Stripe's dashboard pattern:
  - A non-blocking side drawer ("ContextView") is the default, so detail sits beside the main content.
  - A blocking "FocusView" is for start-to-finish tasks that shouldn't be interrupted or need a wider canvas.
- **NN/g data tables** [common], above: a non-modal side panel beats a modal for editing while the list stays visible.
- **No standard picks one universally.** Common practice: a drawer or split pane for quick inspection and triage over a list, and a full page with its own URL for rich records like Action, Member and Form. Both deep-linkable [judgement, drawn from the vendor patterns above].

#### Long forms and editors

- **Vercel Web Interface Guidelines** [vendor]. https://vercel.com/design/guidelines
  - Errors sit next to their fields, and focus moves to the first error on submit.
  - Don't pre-disable submit. Disable it only while the request is in flight.
  - Enter submits single-input forms. Cmd/Ctrl+Enter submits from a textarea.
  - Warn before navigating away from unsaved data.
- **Inline validation: Wroblewski / Etre, 2009** [research, not peer-reviewed: a vendor usability test with about 22 participants and 6 form variants]. https://alistapart.com/article/inline-validation-in-web-forms/
  - The best variant, validating after the field was left, showed 22% more success, 22% fewer errors, 31% higher satisfaction and 42% faster completion than the control.
  - Validating *while* typing performed worst.
- **GOV.UK "one thing per page"** [vendor; based on internal research, not peer-reviewed]. https://design-system.service.gov.uk/patterns/question-pages, https://designnotes.blog.gov.uk/2015/07/03/one-thing-per-page/
  - Designed for infrequent public users.
  - GDS says to start there and merge pages where research shows it helps.
  - Weak fit for daily expert staff [judgement].
- **WCAG 3.3.7 Redundant Entry (A)** [standard]: don't make users re-enter information already given in the same process (wizards such as suite launch). **3.3.4 Error Prevention (AA)** [standard]: legal, financial or data-deleting submissions must be reversible, checked or confirmed.

#### Dashboards

- **NN/g, "Dashboards: Making Charts and Graphs Easier to Understand"** [common]. https://www.nngroup.com/articles/dashboards-preattentive/
  - Dashboards are for at-a-glance monitoring.
  - Encode quantities with length and 2D position (bars, lines, scatter) in preference to area, angle or colour.
  - Reserve strong emphasis. I read this through search excerpts; the underlying perceptual research is Cleveland & McGill.

#### Inbox and queue views (texting, welcome queue)
- **No standard or study found.** Common practice in support tools: a three-pane layout of queue list, thread and context panel; a "needs reply" filter; keyboard next/previous; assignment [common, unsourced; judgement].
- **WCAG 4.1.3 Status Messages (AA)** [standard] applies to live websocket updates: announce new items without moving focus.

#### Feedback: toasts, optimistic updates, undo vs confirm

- **NN/g, "Confirmation Dialogs Can Prevent User Errors — If Not Overused", 2018, reviewed 2026** [common, no data].
  - Confirm only consequential, irreversible actions. Routine confirmations breed habituation.
  - Prefer undo where possible.
  - Use specific, action-labelled buttons.
  - https://www.nngroup.com/articles/confirmation-dialog/
- **Vercel guidelines** [vendor].
  - "Update the UI immediately when success is likely; reconcile on server response."
  - Destructive actions need confirmation or an undo window.
  - Toasts use polite `aria-live`.
- **TanStack Query, Optimistic updates** [vendor]. https://tanstack.com/query/latest/docs/framework/react/guides/optimistic-updates
  - Two documented patterns. "Via the UI" renders pending `variables`; it needs no rollback and suits one display location.
  - "Via the cache" uses `onMutate` snapshot, `onError` restore and `onSettled` invalidate; it suits data shown in several places.
- **Toast accessibility** [common, disputed]. Sources:
  - Scott O'Hara, https://www.scottohara.me/blog/2019/07/08/a-toast-to-a11y-toasts.html
  - Adrian Roselli, https://adrianroselli.com/2020/01/defining-toast-messages.html
  - W3C WAI-IG thread 2025, https://lists.w3.org/Archives/Public/w3c-wai-ig/2025AprJun/0076.html
  - Primer, https://primer.style/accessibility/toasts/

  What they agree on:
  - The live region must exist at page load.
  - Auto-dismissing toasts are disputed under **2.2.1 Timing Adjustable**: notification-only toasts are arguably fine, but toasts with actions such as Undo need extra time or a persistent alternative.
  - Primer's accessibility guidance discourages toasts for important information.

#### Empty, loading and error states

- **NN/g, "Skeleton Screens 101", 2023, reviewed 2026** [common, citing Mejtoft, Långström & Söderström 2018, ECCE, peer-reviewed conference paper]. https://www.nngroup.com/articles/skeleton-screens/
  - Under about 1 s: show no indicator.
  - About 2–10 s: skeleton for a full page, spinner for a module.
  - Over 10 s: progress bar with an estimate.
- **Vercel guidelines** [vendor].
  - Delay spinner or skeleton by about 150–300 ms and keep it visible at least 300–500 ms to avoid flicker.
  - Skeletons mirror the final layout.
  - Keep button labels while loading.
  - "All states designed": empty, sparse, dense, error.
- Repo rule "fail loudly" (AGENTS.md) points the same way for error states.

---

### 3. What reads as "modern" and frictionless

#### Which leading products publish guidance (checked Nov 2026)

| Product | What is public | Notes |
|---|---|---|
| **IBM Carbon** | Full system: tokens, type, spacing, motion, data table densities, accessibility | Most complete published guidance for data-heavy enterprise UI [vendor] |
| **Atlassian** | Foundations (8 px spacing base, typography tokens, colour tokens), navigation-system docs | Spacing tokens are multiples of an 8 px base. Legacy typography was deprecated and supported to Jan 2026 [vendor]. https://atlassian.design/foundations/spacing |
| **GitHub Primer** | Layout, breakpoints, accessibility guidance (toasts and more), components | No numeric density guidance [vendor] |
| **Vercel Geist** | Components, colours, type, materials, grid, plus a separate **Web Interface Guidelines** page | Geist itself is mostly reference. The written rules are in the guidelines [vendor]. https://vercel.com/geist/introduction |
| **Shopify Polaris** | **Polaris React is deprecated** and closed to contributions. Shopify moved to Polaris Web Components (GA with API 2025-10). The old polaris-react docs redirect | Not a viable foundation for a React app [vendor]. https://shopify.dev/changelog/blog/polaris-unified-and-for-the-web |
| **Stripe** | No general design system. Only the Stripe Apps UI toolkit and patterns (drawer, ContextView/FocusView) | Custom styling deliberately limited for consistency and contrast [vendor] |
| **Linear** | No design system. Blog posts on its own redesigns | Useful as a statement of intent, not a spec [vendor] |

#### Recurring prescriptions in those sources

- **Type:** a single neutral sans with a small scale. Linear uses Inter with Inter Display for headings; Vercel uses Geist Sans and Mono; Carbon uses IBM Plex [vendor]. No standard scale exists.
- **Spacing:** a 4 or 8 px base grid (Atlassian 8 px base, Carbon 8 px mini-units) [vendor].
- **Density:** comfortable by default with compact options (Carbon's five table sizes). Linear's stated goal is high density with recessive chrome [vendor].
- **Colour:** perceptual colour spaces for generated themes. Linear moved to LCH with three inputs (base, accent, contrast) and auto-generated high-contrast themes. shadcn/ui moved its tokens to OKLCH [vendor]. A floor of WCAG **1.4.3** (4.5:1 text) and **1.4.11** (3:1 UI components and focus) [standard].
- **Dark mode:** offered by all of them [common].
  - Research: **Piepenbrock, Mayr, Mund & Buchner, *Ergonomics*, 2013** (peer-reviewed; younger and older adults). Dark-on-light (positive polarity) gave better visual acuity and proofreading. Follow-ups in 2014 (*Ergonomics*, pupil-size study; *Human Factors*, small character sizes) found the effect strongest for small text.
  - I read abstracts only: https://informahealthcare.com/doi/abs/10.1080/00140139.2013.790485
  - Light default with dark as an option fits this evidence [judgement].
- **Motion: Carbon** [vendor].
  - "Productive" motion is for task UI: 70 ms buttons, 110 ms fades, 150 ms small expansions, 240 ms toasts and expansions.
  - "Expressive" motion is reserved for rare moments.
  - Easing curve given as `cubic-bezier(0.2,0,0.38,0.9)`.
  - Vercel adds: honour `prefers-reduced-motion`, animate only transform and opacity, keep animations interruptible, never `transition: all`.
  - https://carbondesignsystem.com/elements/motion/overview/

#### Aesthetics and perceived usability

- **Kurosu & Kashimura, CHI '95 companion** [research, peer-reviewed short paper; 252 participants, 26 ATM layouts]. Rated beauty correlated more with *perceived* than with actual ease of use. Via NN/g: https://www.nngroup.com/articles/aesthetic-usability-effect/
- **Tractinsky, Katz & Ikar, *Interacting with Computers* 13(2), 2000** [research, peer-reviewed; ATM simulation, pre- and post-use ratings]. Perceived beauty predicted post-use perceived usability. I read abstracts and secondary sources only. https://academic.oup.com/iwc/article-abstract/13/2/127/898608
- **Hassenzahl, *HCI* journal, 2004** [research, peer-reviewed; 4 MP3-player skins]. Beauty was stable with use, while perceived usability and "goodness" shifted with experience.
- **Hassenzahl & Monk, 2010** [research, peer-reviewed review]. 25 correlations from 15 papers between beauty and perceived usability, with wide variability.
- **Tuch et al., 2012** [research, peer-reviewed]. Experimentally, aesthetics did *not* raise perceived usability, while usability raised post-use perceived beauty.
- **Net** [judgement]: polish raises first impressions and tolerance for small problems, but for a tool used daily, real usability dominates over time. Visual polish cannot substitute for fixing friction.

#### What slows expert users down (evidence)

- **Latency** [research, mixed quality].
  - Shneiderman's 1984 review (*ACM Computing Surveys*, peer-reviewed): users prefer sub-second responses and productivity rises. https://www.cs.umd.edu/users/ben/papers/Shneiderman1984Response.pdf
  - The often-cited **Doherty & Thadani 1982** IBM report (400 ms) is a non-peer-reviewed vendor report. I could not verify its data.
  - **Miller 1968**'s 100 ms / 2 s thresholds were, by its own account, informed estimates.
- **Failure to adopt shortcuts** (Lane 2005; Scarr 2011) [research], above: speed gains come only when shortcuts are discoverable in place.
- **Over-confirmation and habituation** [common], above.
- **Modals hiding context while editing** [common], above.
- No peer-reviewed study was found on Cmd+K palettes, saved views or density specifically.

---

### 4. Component foundation for React 19 + Tailwind CSS 4 (status Nov 2026)

| Library | Status | React 19 / Tailwind 4 | Accessibility claim and what backs it |
|---|---|---|---|
| **shadcn/ui** (copy-in components) | Active. **Base UI became the default base in Jul 2026.** Radix remains "fully supported" and "not being deprecated". **React Aria was added as a third base in Jul 2026.** A migration skill moves Radix to Base UI one component per commit. https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default, https://ui.shadcn.com/docs/changelog/2026-07-react-aria | All components updated for **Tailwind v4 and React 19**: `forwardRef` removed, `data-slot` added, OKLCH tokens. Its toast is deprecated for `sonner`. https://ui.shadcn.com/docs/tailwind-v4 | Inherits the base library's behaviour. Styling and contrast are the app's responsibility [vendor] |
| **Base UI** (`@base-ui/react`, MUI team) | **v1.0 stable 11 Dec 2025.** Monthly 1.x releases through at least 1.6 (Jun 2026); a third party reports 1.8 in Sep 2026 (unverified). Drawer stable since 1.3. https://base-ui.com/react/overview/releases/v1-0-0.md | Unstyled, works with any CSS including Tailwind | Follows WAI-ARIA APG keyboard patterns. "Tested on a broad spectrum of browsers, devices, platforms, screen readers". **No published test matrix or results.** The developer owns focus styles, contrast and labels. https://base-ui.com/react/overview/accessibility [vendor claim] |
| **Radix Primitives** (WorkOS) | Maintained but slower. Releases jumped from **Aug 2025 to Jun 2026**, then Jun 30 and Jul 6/20 2026 releases fixed several **React 19 / 19.2 re-render and stale-handler bugs**. https://radix-ui.com/primitives/docs/overview/releases | Works with React 19 after those fixes; unstyled | APG-based. Testing not documented [vendor claim] |
| **React Aria Components** (Adobe) | Active, Adobe-backed | Official Tailwind v4 plugin `tailwindcss-react-aria-components` (2.x) with state modifiers (`selected:`, `disabled:`) and `tw-animate-css` guidance. https://react-aria.adobe.com/styling | **The most specific published testing:** VoiceOver (macOS Safari and Chrome, iOS), JAWS and NVDA (Windows Firefox and Chrome), TalkBack (Android Chrome). Internationalisation in 30+ languages with RTL. Methods and results are not published. https://react-aria.adobe.com/quality [vendor claim] |
| **Ark UI** (Chakra team, Zag.js state machines) | Active. Zag 1.42 released Jun 2026. https://ark-ui.com/docs/changelog/react | Unstyled | README claims WCAG compliance and assistive-technology testing. No published matrix [vendor claim] |
| **Mantine 9** | Active. v9 requires **React ≥ 19.2**; latest 9.7.x. https://mantine.dev/guides/8x-to-9x | Styled with its own CSS-modules/PostCSS system. **No Tailwind integration guide found** (its old Tailwind guide URL now returns 404). It would be a second styling system beside Tailwind [judgement] | Vendor claims, not checked in depth |

**Independent verification:** no independent, published screen-reader audit was found for any of these libraries. Every accessibility claim above is the vendor's own. React Aria's is the most specific.

**Admin frameworks**
- **Refine** (core v5, built on TanStack Query v5) [vendor]. https://refine.dev/core/docs/guides-concepts/data-fetching/
  - Its data hooks route through a `DataProvider` contract (`getList`, `getOne`, `create`, `update`, `deleteOne`…, returning `{ data, total }` and `HttpError` errors).
  - An existing client can be wrapped inside a provider.
- **React Admin v5 / ra-core / shadcn-admin-kit (Marmelab)** [vendor]. https://marmelab.com/react-admin/DataFetchingGuide.html, https://marmelab.com/shadcn-admin-kit/docs/dataproviders/
  - Same single `dataProvider` abstraction over TanStack Query.
  - shadcn-admin-kit pairs ra-core with shadcn components.
- **Fit** [judgement]: both assume a resource-oriented CRUD API behind one provider. This app has a generated typed NestJS client, direct TanStack Query hooks and many non-CRUD screens (form builder, suite wizard, friend graph, live texting). Adopting either would mean writing provider adapters that discard the generated types at the provider boundary, and building most bespoke screens outside the framework anyway. Their value is CRUD scaffolding, which this app mostly already has.

---

### 5. Carrying out a large UI redesign

#### Rewrite vs incremental

- **Martin Fowler, "Strangler Fig Application", rev. 22 Aug 2024** [common, expert practitioner]. https://martinfowler.com/bliki/StranglerFigApplication.html
  - Big-bang replacements have "gone down in flames most of the time".
  - Prefer incremental replacement behind seams, with transitional architecture so old and new coexist.
- **Joel Spolsky, "Things You Should Never Do, Part I", 2000** [common]. https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/. Rewrites throw away the accumulated bug fixes embedded in old code.
- **Linear, 2024 and 2026 redesigns** [vendor case study]: shipped behind feature flags with an in-app old/new toggle, then internal dogfooding, private beta, percentage rollout and GA. The 2026 refresh was "released incrementally… avoided shipping everything at once".
- **Block, "From Base Web to Fluent UI without a flag day"**, Dec 2024 – Feb 2026 [vendor case study; I read a ZenML summary of the primary post]. https://engineering.block.xyz/blog/from-base-web-to-fluent-ui-without-a-flag-day
  - Scope: an internal console of about 11k files with 40–60 engineers committing daily, migrated by agents.
  - About 210 days building migration machinery: per-file end-state rules, 20+ custom linters, a TypeScript language service for fast diagnostics, a warm Jest process.
  - Then about 240 days migrating in waves: 1,004 commits and 14,713 file changes.
  - The new UI lived in a temporary parallel "lane". Visual parity was left to human judgement, with no automated visual regression. Some agent migrations were reverted and redone by hand.
- **Design-system-first:** no empirical study found. Common practice, as Block's platform-first phase and Linear's "behaviour definitions for core components" before rollout show [common].

#### Pull request size vs review effectiveness

- **SmartBear/Cisco study, 2006** [research, not peer-reviewed vendor study; about 2,500 reviews, 3.2M LOC]. I read secondary summaries; the primary sits behind a form.
  - Defect-finding density drops sharply above about 200–400 LOC per review.
  - Effectiveness falls after about 60–90 minutes.
  - https://agileconnection.com/article/largest-case-study-code-reviews-ever
- **Sadowski et al., "Modern Code Review: A Case Study at Google", ICSE-SEIP 2018** [research, peer-reviewed; 9M changes, 12 interviews, 44 survey respondents]. https://research.google/pubs/modern-code-review-a-case-study-at-google/
  - Google's norm is small changes: a median of about 24 lines, about 90% touching under 10 files.
  - These figures come from a secondary summary and need checking against the paper.
- **Agentic PRs: "Where Do AI Coding Agents Fail?", arXiv 2601.15195** [research, peer-reviewed, accepted at MSR 2026; about 33k agent PRs from five agents, plus 600 rejected PRs coded qualitatively]. https://arxiv.org/abs/2601.15195
  - Unmerged agent PRs "tend to involve larger code changes, touch more files, and often do not pass… CI".
  - "Lack of meaningful reviewer engagement" was one rejection pattern.
- **"On the Use of Agentic Coding", arXiv 2509.14745** [research, reported accepted at TOSEM; 567 Claude Code PRs across 157 projects]. https://arxiv.org/abs/2509.14745
  - 83.8% of agent PRs were accepted vs 91.0% of human PRs.
  - Rejections were driven by project context, **including PR size**, more than by code flaws.
- **Implication for "one PR in 12 hours"** [judgement]: every source above points against one very large unit of review. If the deliverable must be one PR, the evidence supports making each *commit* a small, separately reviewable unit (which the repo already requires) and keeping each reviewer's slice small.

#### Visual regression testing

- **Playwright, Visual comparisons** [vendor]. https://playwright.dev/docs/test-snapshots
  - `toHaveScreenshot()` baselines are per browser and platform.
  - Rendering differs with OS, hardware and headless mode, so generate and compare baselines in the same environment.
  - Tolerance comes from `threshold` (default 0.2) and `maxDiffPixels`. A `stylePath` stylesheet hides dynamic content.
- **Pei, Sohn & Papadakis, "An Empirical Study of Web Visual Flakiness", *J. Systems & Software*, 2026** [research, peer-reviewed journal (pre-proof seen); 262 real cases]. https://orbilu.uni.lu/bitstream/10993/68138/1/1-s2.0-S0164121226000609-main.pdf. Characterises visual flakiness causes and fixes. I read only the abstract.
- **Romano et al., arXiv 2103.02669** [research, ICSE 2021; 235 flaky UI tests from 62 projects]. Root causes include async waits and rendering timing.
- **Fit** [judgement]: visual regression protects a refactor that should leave pixels unchanged. A redesign intentionally changes every pixel, so baselines would be *created* by the redesign, not checked against the old ones. Old-vs-new screenshots are review evidence, not pass/fail tests.

#### Large migrations and rewrites by AI coding agents

- **Google, "How is Google using AI for internal code migrations?", ICSE-SEIP 2025** [research, peer-reviewed experience report]. https://arxiv.org/abs/2501.06972
  - Covers Ads int32→int64 IDs, JUnit3→4 (5,359 files, about 149k lines in 3 months) and Joda→java.time.
  - "Simple prompting is not sufficient for anything but the simplest of migrations."
  - Changes were split into small reviewable units, with humans reviewing every change.
- **Google, "Migrating Code At Scale With LLMs At Google", arXiv 2504.09691, FSE 2025 industry track** [research]. https://arxiv.org/abs/2504.09691. 39 migrations by 3 developers over 12 months. 74.45% of code changes were LLM-generated, with an estimated 50% time reduction. I read the abstract only.
- **Airbnb, "Accelerating Large-Scale Test Migration with LLMs", Mar 2025** [vendor case study]. https://airbnb.tech/?p=366
  - Migrated about 3,500 Enzyme test files to RTL in about 6 weeks, against an estimated 1.5 engineer-years by hand.
  - Per-file pipeline: rewrite, pass Jest, pass lint and tsc, with retries carrying error feedback.
  - About 97% automated; humans finished the rest.
- **Anthropic, "Building a C compiler with a team of parallel Claudes", 5 Feb 2026** [vendor case study]. https://www.anthropic.com/engineering/building-c-compiler
  - 16 parallel agents, about 2,000 sessions over about 2 weeks, about $20k, about 100k LOC.
  - Agents claimed tasks through lock files in a shared repo, with no orchestrator.
  - Lessons:
    - "The verifier must be nearly perfect."
    - Parallelism works for many independent failures but stalls on one big task: all 16 agents piled onto the same bug until a GCC oracle split the work.
    - CI was needed to stop new work breaking old.
    - Merge conflicts were frequent.
    - No human code review is described, and the author is uneasy shipping unverified code.
- **Cursor, "Scaling long-running autonomous coding", Jan 2026** [vendor case study]. https://cursor.com/blog/scaling-agents
  - Planner/sub-planner/worker roles; workers do not coordinate with each other.
  - Hundreds of agents produced about 1M LOC (a browser) in about a week; secondary coverage says it "kind of works".
  - Open problems: drift, agents that run too long, and the need for periodic fresh starts.
- **Bun, "Bun in Rust"** [vendor case study, read 2026-11-24]. https://bun.com/blog/bun-in-rust
  - Bun's Zig-to-Rust rewrite ran as about 50 scripted workflows over 11 days, with up to 64 agents at once.
  - A porting guide was written before any code, and the approach was tried on 3 files before fanning out.
  - Each unit had one implementer, two adversarial reviewers who saw only the diff, and one fixer.
  - The first pass was a mechanical, structure-preserving port; restructuring came after.
  - "Compiler errors are a better feedback loop than a style guide."
  - 19 regressions shipped.
- **Common thread across the agent case studies** [judgement from the sources above]:
  - Success came from **machine-checkable per-unit end states** (types, lint rules, tests, oracles) and small independently verifiable units.
  - Shared foundations came **first** (Block's 210-day platform phase; Google's tooling).
  - None of them did a visual redesign under a 12-hour budget. Visual and UX correctness was the part left to humans (Block).

---

### Where a clear standard exists, and where none does

**Clear standard or strong vendor consensus**
- Accessibility floor: **WCAG 2.2 AA** [standard]. The criteria most at stake here:
  - 1.4.3 / 1.4.11 contrast
  - 2.1.4 single-key shortcuts
  - 2.4.5 multiple ways
  - 2.4.7 / 2.4.11 focus
  - 2.5.7 drag alternatives
  - 2.5.8 target size
  - 3.3.7 redundant entry
  - 4.1.3 status messages
- Keyboard behaviour of widgets: **WAI-ARIA APG** (one tab stop per composite, arrow keys inside, avoid OS/AT/browser shortcut clashes) [vendor, W3C].
- Polaris React is deprecated [vendor fact].
- shadcn/ui's current default is Base UI on Tailwind 4 / React 19, with Radix and React Aria also supported [vendor fact].
- Optimistic-update mechanics: **TanStack Query docs** [vendor].
- Small reviewable changes: Cisco, Google and the MSR 2026 agent-PR study converge [research].
- Incremental over big-bang replacement: Fowler; Linear, Block and Google practice [common/vendor].
- Visual-regression baselines must be generated in a fixed environment [vendor].

**No standard (only common practice or judgement)**
- How many sidebar items or groups; command palette design; saved views; inbox/queue layout.
- Page vs drawer vs split view (vendor patterns differ by context).
- Type scale, exact spacing, density levels, and motion beyond Carbon's own tokens.
- Dark mode as a default (research favours light for legibility; offering both is common).
- Pagination vs virtual scroll for back-office tables.
- Whether auto-dismissing toasts meet WCAG 2.2.1 (disputed).
- Design-system-first sequencing (no empirical study).
- Any independent audit of headless libraries' accessibility claims.
- How to split and verify a multi-agent UI redesign. No published case study matches this scale and timeline; the closest (Block) took 15 months.

---

### Summary

The only formal standards in scope are WCAG 2.2 AA and the WAI-ARIA Authoring Practices. They fix the accessibility floor: contrast, focus, keyboard composites, single-key shortcuts, drag alternatives, status messages. They say nothing about how an admin should look or be organised.

On top of that floor, leading vendors converge on common practice:
- A left sidebar for app destinations plus global search or a command palette.
- URL-persisted filters and views; data tables with frozen headers, bulk actions and clear active filters.
- Side panels or split views for quick inspection, and full pages for rich records.
- Undo over routine confirmations; optimistic updates using TanStack Query's documented patterns.
- An 8 px spacing base, perceptual-colour (LCH/OKLCH) tokens, and fast "productive" motion.

Empirical research is thin and mostly old:
- Aesthetics raises perceived usability, but inconsistently, and less over time.
- Experts under-adopt shortcuts unless shortcuts are surfaced in place.
- Dark-on-light text reads better.
- Small reviews catch more defects, and large or multi-file agent PRs are merged less often.

For the foundation, shadcn/ui on Base UI (its default since July 2026), or React Aria (the most specifically documented accessibility testing), both support React 19 and Tailwind 4. Polaris React is deprecated. Refine and React Admin assume a CRUD data-provider layer that this typed-client app would have to adapt to.

Every published large migration, by humans or agents, succeeded by building shared foundations and machine-checkable per-unit end states first, then moving in small verified increments. None matches a full visual redesign as one PR in 12 hours, so for that plan there is no precedent, only judgement.

## Measurements

Taken on 2026-11-24 against revision c722280863, the base of the `modern-admin` branch.

### The admin's size

- **432 non-test `.tsx` files, 71,833 lines** (about 72,000). Method: `git ls-files` under `apps/admin/src`, keeping `.tsx` files and dropping any path with `.test.`, `__tests__` or `/test/`, then `wc -l` over their contents.
- **230 test files, 42,808 lines** (about 43,000). Method: `git ls-files` in `apps/admin` matching `*.test.tsx`, then `wc -l`. Counting `*.test.ts` as well gives 398 files and 63,919 lines; the 230 figure is `.tsx` tests only.

### Imports of the shared UI package

- **265 files in `apps/admin` import from `sharedweb/ui`**, 185 of them non-test. Method: `git ls-files` in `apps/admin` for `.ts` and `.tsx`, then `grep -l` for an import whose specifier contains `sharedweb/ui`.

### Admin usage in production

- **Production's admin sends no page views to PostHog.** Method: a HogQL query through PostHog's query API (`POST https://us.posthog.com/api/projects/@current/query/`) returned HTTP 200 and 0 events:

  ```sql
  select count() as events, min(timestamp) as first, max(timestamp) as last
  from events
  where properties.app = 'admin' and timestamp > now() - interval 90 day
  ```

- Cause: the admin's PostHog reporting (`apps/admin/src/lib/analytics.ts`, page views tagged `app: admin` with route-template URLs) arrived in commit `a03200601d` (#1073), merged to `main` on 2026-11-24. Production ran `2c5eb2ec07` (2026-11-19), per `GITHUB_REPOSITORY=worldalliance/alliance bash .github/actions/deploy-guard/live-commit.sh production`, and `git merge-base --is-ancestor a03200601d 2c5eb2ec07` showed #1073 is not in it. So there is no per-route usage data until `main` reaches production and staff use the admin for a while; usage was not reconstructed from other sources such as server logs.

### The Tailwind lint plugin

The plugin's metadata was checked on 2026-11-24. The install was run on 2026-11-25 by a reviewer of this branch, at the commit that adds this section, with bun 1.4.4.

- **`eslint-plugin-better-tailwindcss` 4.11.0 supports Tailwind CSS 4 and has a `no-restricted-classes` rule.** Source: the package's npm metadata, https://www.npmjs.com/package/eslint-plugin-better-tailwindcss (a community plugin, common practice; not a vendor recommendation).
- **Installing it moved six existing packages to new top-level versions in `bun.lock` and removed one.** Method: `cd apps/frontend && bun add -d eslint-plugin-better-tailwindcss@4.11.0`, then `git diff bun.lock`, then reverted. Moved: `synckit` 0.11.12 to 0.12.3, `enhanced-resolve` 5.20.1 to 5.25.1, `tapable` 2.3.2 to 2.3.3, `mdn-data` 2.0.14 to 2.37.2, `ajv-keywords` 3.5.2 to 5.1.0, `@pkgr/core` 0.2.9 to 0.3.6. Removed: `@expo/ws-tunnel` with its nested `ws`. `valibot` 1.5.0 was only added, nested under the plugin. The plugin's peer range is `tailwindcss: ^3.3.0 || ^4.1.17` (`npm view eslint-plugin-better-tailwindcss@4.11.0 peerDependencies`).

